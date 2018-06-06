import {createWeb3, deployContract, expectThrow} from 'ethworks-solidity';
import escrowJson from '../../build/contracts/Escrow.json';
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

xdescribe('Escrow', () => {
  const {BN} = web3.utils;
  let seller;
  let buyer;
  let contract;
  let accounts;
  const args = [];
  const price = new BN('1').mul(new BN('10').pow(new BN('18')));
  const doublePrice = price.mul(new BN('2'));
  const gasCost = new BN('304140000000000');
  const balanceOf = async (client) => new BN(await web3.eth.getBalance(client));


  before(async () => {
    accounts = await web3.eth.getAccounts();
    [seller, buyer] = accounts;
  });

  beforeEach(async () => {
    contract = await deployContract(web3, escrowJson, seller, args, doublePrice);
  });

  it('should be deployed successfully', async () => {
    const {address} = contract.options;
    expect(address).to.not.be.null;
  });

  describe('Escrow', async() => {
    it('should be properly created', async () => {
      const actualPrice = await contract.methods.price().call();
      expect(actualPrice).to.eq.BN(price);
    });
  
    it('Should not allow to create with an odd amount', async() => {
      await expectThrow(deployContract(web3, escrowJson, seller, args, new BN('11')));
    });
  
    it('Should not allow to confirm purchase without sending ether', async() => {
      await expectThrow(contract.methods.confirmPurchase().send({from: buyer, value: 0}));
      await expectThrow(contract.methods.confirmPurchase().send({from: seller, value: 0}));
    });

    it('Should not allow to confirm purchase with wrong amount', async() => {
      await expectThrow(contract.methods.confirmPurchase().send({
          from: buyer, value: doublePrice.add(doublePrice)}));
    });

    it("should not cancel after confirm", async() => {
      await contract.methods.confirmPurchase().send({from: buyer, value: doublePrice});
      await expectThrow(contract.methods.cancel().send({from: seller}));
    });

    it("should not cancel by random dude", async() => {
      await expectThrow(contract.methods.cancel().send({from: buyer}));
    });

    it("should not confirmRecived by random dude", async() => {
      await contract.methods.confirmPurchase().send({from: buyer, value: doublePrice});
      await expectThrow(contract.methods.confirmReceived().send({from: seller}));
    });

    it("should not confirmRecived before purchase", async() => {
      await expectThrow(contract.methods.confirmReceived().send({from: buyer}));
      await expectThrow(contract.methods.confirmReceived().send({from: seller}));
    });

    it("should not be able to send money to cancel", async() => {
      await expectError(contract.methods.cancel().send({from: seller, value: price}));
      await contract.methods.cancel().send({from: seller});
    });

    it('should not be able to send money to confirmReceived', async() => {
      await contract.methods.confirmPurchase().send({from: buyer, value: doublePrice});
      await expectError(contract.methods.confirmReceived().send({from: buyer, value: doublePrice}));
      await contract.methods.confirmReceived().send({from: buyer});
    });

    it('should not be able to do anything after cancel', async() => {
      await contract.methods.cancel().send({from: seller});
      expect(await web3.eth.getCode(contract.options.address)).to.equal("0x0");
    });


    it('should transfer funds to seller and buyer', async() => {
      await contract.methods.confirmPurchase().send({from: buyer, value: doublePrice});
      await contract.methods.confirmReceived().send({from: buyer})
    });

  });

  describe('checking funds', async() => {
    let sellerBalanceBefore;
    let buyerBalanceBefore;
    let sellerBalanceAfter;
    let buyerBalanceAfter;
    let txCost;

    const addTransactionCost = async(receipt) => {
      const tx = await web3.eth.getTransaction(receipt.transactionHash);
      txCost = txCost.add(new BN(receipt.gasUsed).mul(new BN(tx.gasPrice)));
    };

    const closeOrConfirm = async(transaction) => {
      sellerBalanceBefore = await balanceOf(seller);
      buyerBalanceBefore = await balanceOf(buyer);
      txCost = new BN(0);

      const receipt = await transaction;
      await addTransactionCost(receipt);
    };

    const calcBalancesAfter = async() => {
      sellerBalanceAfter = await balanceOf(seller);
      buyerBalanceAfter = await balanceOf(buyer);
    };

    it('should return funds to seller after cancel', async() => {
      await closeOrConfirm(contract.methods.cancel().send({from: seller}));
      await calcBalancesAfter();
      expect(sellerBalanceAfter.sub(sellerBalanceBefore)).to.eq.BN(doublePrice.sub(txCost));
    });

    xit('should return funds to seller and buyer after confirmReceived', async() => {
      await closeOrConfirm(contract.methods.confirmPurchase().send({from: buyer, value: doublePrice}));
      await calcBalancesAfter();

      expect(sellerBalanceAfter).to.be.eq.BN(sellerBalanceBefore);
      expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.eq.BN(doublePrice.sub(txCost));

      const purchaseReceit = await contract.methods.confirmReceived().send({from: buyer});
      await addTransactionCost(purchaseReceit);
      await calcBalancesAfter();

      expect(sellerBalanceAfter.sub(sellerBalanceBefore)).to.eq.BN(doublePrice.add(price));
      expect(buyerBalanceAfter.sub(buyerBalanceBefore)).to.eq.BN(price.sub(txCost));
    });


  });

  
});
