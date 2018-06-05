import {createWeb3, deployContract, expectThrow} from 'ethworks-solidity';
import splitterJson from '../../build/contracts/Splitter.json';
import StandardTokenJson from '../../build/contracts/StandardTokenMock.json';

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

describe('Splitter', () => {
  const {BN} = web3.utils;
  let tokenOwner;
  let splitterOwner;
  let feeCollector;
  let addr1;
  let addr2;
  let addr3;
  let splitter;
  let splitterAddr;
  let tokenContract;
  let tokenAddr;
  let accounts;
  let txCost;

  const tokensCap = new BN('100').mul(new BN('10').pow(new BN('18')));
  const someAmount = new BN('1').mul(new BN('10').pow(new BN('18')));
  const finney = new BN('1').mul(new BN('10').pow(new BN('15')));

  const balanceOf = async (client) => new BN(await web3.eth.getBalance(client));


  const addTransactionCost = async(receipt) => {
      txCost = new BN('0');
      const tx = await web3.eth.getTransaction(receipt.transactionHash);
      txCost = txCost.add(new BN(receipt.gasUsed).mul(new BN(tx.gasPrice)));
    };


  before(async () => {
    accounts = await web3.eth.getAccounts();
    [tokenOwner, splitterOwner, feeCollector, addr1, addr2, addr3] = accounts;
  });

  beforeEach(async () => {
    const splitterArgs = [[addr1, addr2], feeCollector];
    const tokenArgs = [tokenOwner, tokensCap];
    splitter = await deployContract(web3, splitterJson, tokenOwner, splitterArgs);
    splitterAddr = splitter.options.address;
    tokenContract = await deployContract(web3, StandardTokenJson, tokenOwner, tokenArgs);
    tokenAddr = tokenContract.options.address;
  });

  it('should be deployed successfully', async () => {
    const {address} = splitter.options;
    expect(address).to.not.be.null;

    const {address2} = tokenContract.options;
    expect(address2).to.not.be.null;

  });

  describe('Splitter basic', async() => {

    beforeEach(async() => {
      await tokenContract.methods.approve(splitter.options.address, someAmount).send({ from:tokenOwner });

    });

    it('check allowance', async() => {
      //console.log(splitter.options.address);
      const allowance = await tokenContract.methods.allowance(tokenOwner, splitter.options.address).call();
      expect(allowance).to.be.eq.BN(someAmount);

      const balance = await tokenContract.methods.balanceOf(tokenOwner).call();
      expect(balance).to.be.eq.BN(tokensCap);
    });

    it('should be split', async () => {

      await splitter.methods.split(tokenAddr, someAmount).send({from: tokenOwner, value: finney});
      let b1 = await tokenContract.methods.balanceOf(addr1).call();
      expect(b1).to.be.eq.BN(someAmount.div(new BN("2")));
      let b2 = await tokenContract.methods.balanceOf(addr1).call();
      expect(b2).to.be.eq.BN(someAmount.div(new BN("2")));
    });

     it('should take fee', async () => {
      await expectThrow(splitter.methods.split(tokenAddr, someAmount).send({from: tokenOwner}));
      await expectThrow(splitter.methods.split(tokenAddr, someAmount).send({from: tokenOwner, value: finney.add(finney)}));
    });

     it('should be able to withdraw', async() => {
       await splitter.methods.split(tokenAddr, someAmount).send({from: tokenOwner, value: finney});
       let before = await balanceOf(feeCollector);
       let receit = await splitter.methods.withdrawFee().send({from: feeCollector});
       addTransactionCost(receit);
       let after = await balanceOf(feeCollector);
       expect(after.sub(before)).to.be.eq.BN(finney.sub(txCost));
     });

     it('should fail with zero', async() => {
       await expectThrow(splitter.methods.split(tokenAddr, new BN('0')).send({from: tokenOwner, value: finney}));
     });

     it('should fail with more', async() => {
       await expectThrow(splitter.methods.split(tokenAddr, someAmount.add(someAmount)).send({from: tokenOwner, value: finney}));
     });



  });


});

