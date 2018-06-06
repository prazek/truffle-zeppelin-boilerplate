import {createWeb3, deployContract, expectThrow} from 'ethworks-solidity';
import KittyHubChannelJson from '../../build/contracts/KittyHubChannel.json';

import { sha3 } from 'ethereumjs-util'

import chai from 'chai';
import bnChai from 'bn-chai';
import Web3 from 'web3';

const {expect} = chai;
const web3 = createWeb3(Web3);
chai.use(bnChai(web3.utils.BN));

async function expectError(promise) {
  try {
    await expectThrow(promise);
  } catch (error) {
    return;
  }
  throw Error('Expected error not received');
}

function waitBlock() {
  return new Promise((resolve, reject) =>
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: 0
    }, function(err, result) {
      if (err) return reject(err);
      return resolve(result);
    }));
}

async function waitNBlocks(n) {
  for (var i = 0; i < n; ++i) {
    await waitBlock();
  }
}

describe('KittyHubChannel', () => {
  const {BN} = web3.utils;
  let owner;
  let user;
  let contract;
  let contractAddr;
  let txCost;
  let accounts;
  let blocksNum = new BN('5');
  const funds = new BN('2').mul(new BN('10').pow(new BN('18')));
  const kittyViewPrice = new BN('1').mul(new BN('10')).pow(new BN('12'));


  const balanceOf = async (client) => new BN(await web3.eth.getBalance(client));

  const prepareMessageToSign = async (client, declaredKitties) => {
      return await contract.methods.prepareMessageToSign(client, declaredKitties).call();
  };


  const addTransactionCost = async(receipt) => {
      txCost = new BN('0');
      const tx = await web3.eth.getTransaction(receipt.transactionHash);
      txCost = txCost.add(new BN(receipt.gasUsed).mul(new BN(tx.gasPrice)));
    };


  before(async () => {
    accounts = await web3.eth.getAccounts();
    [owner, user] = accounts;
  });

  beforeEach(async () => {
    const args = [blocksNum];
    contract = await deployContract(web3, KittyHubChannelJson, owner, args);
    contractAddr = contract.options.address;

  });

  const withdrawableBalance = async() => new BN(await contract.methods.ownerWithdrawableFunds().call());

  it('should be deployed successfully', async () => {
    const {address} = contract.options;
    expect(address).to.not.be.null;
  });

  it('check kitten view price', async () => {
    let currentKittyPrice = await new BN(await contract.methods.KITTY_VIEW_PRICE().call());
    expect(currentKittyPrice).to.be.eq.BN(kittyViewPrice);
  });

  describe('contract basic', async() => {

    beforeEach(async() => {
      await contract.methods.addFunds().send({value: funds, from: user});
    });

    it ('close without dispute', async() => {
        let prepared = await prepareMessageToSign(user, 0);
        let signed = await web3.eth.sign(prepared, user);
        await contract.methods.closeChannel(user, 0, signed).send({from: user});

        await waitNBlocks(blocksNum);
        let before = await balanceOf(user);
        let tx = await contract.methods.withdrawClosedChannel(user).send({from: user});

        let after = await balanceOf(user);
        await addTransactionCost(tx);
        expect(after.sub(before)).to.be.eq.BN(funds.sub(txCost));
    });

    describe('advanced closing', async() => {

        beforeEach(async() => {
            let prepared = await prepareMessageToSign(user, 2);
            let signed = await web3.eth.sign(prepared, user);
            await contract.methods.closeChannel(user, 2, signed).send({from: user});
        });

        it ('close with dispute', async() => {
            let prepared = await prepareMessageToSign(user, 42);
            let betterReceit = await web3.eth.sign(prepared, user);
            await contract.methods.provideBetterReceit(user, 42, betterReceit).send({from: owner});

            await waitNBlocks(blocksNum);

            let beforeContract = await withdrawableBalance();
            let before = await balanceOf(user);

            let tx = await contract.methods.withdrawClosedChannel(user).send({from: user});

            let afterContract = await withdrawableBalance();

            let contractDiff = afterContract.sub(beforeContract);
            expect(contractDiff).to.be.eq.BN(new BN("42").mul(kittyViewPrice));


            let after = await balanceOf(user);
            await addTransactionCost(tx);
            expect(after.sub(before)).to.be.eq.BN(funds.sub(txCost).sub(contractDiff));

            await expectThrow(contract.methods.withdrawUsersFunds().send({from: user}));

            let beforeOwner = await balanceOf(owner);
            tx = await contract.methods.withdrawUsersFunds().send({from: owner});
            await addTransactionCost(tx);
            let afterOwner = await balanceOf(owner);
            expect(afterOwner.sub(beforeOwner)).to.be.eq.BN(contractDiff.sub(txCost));

            afterContract = await withdrawableBalance();
            expect(afterContract).to.be.eq.BN(new BN('0'));
    });

    it ('bs receit', async() => {
        let betterReceit = await web3.eth.sign("bs", user);
        await expectThrow(contract.methods.provideBetterReceit(user, 42, betterReceit).send({from: owner}));
    });
    it ('receit from other user', async() => {
        let prepared = await prepareMessageToSign(user, 42);
        let betterReceit = await web3.eth.sign(prepared, owner);
        await expectThrow(contract.methods.provideBetterReceit(user, 42, betterReceit).send({from: owner}));

        prepared = await prepareMessageToSign(owner, 42);
        betterReceit = await web3.eth.sign(prepared, owner);
        await expectThrow(contract.methods.provideBetterReceit(user, 42, betterReceit).send({from: owner}));
    });

  });


  });

});
