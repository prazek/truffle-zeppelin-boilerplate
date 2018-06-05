import {createWeb3, deployContract, expectThrow} from 'ethworks-solidity';
import guessingGameJson from '../../build/contracts/GuessingGame.json';

import { sha3 } from 'ethereumjs-util'
/*import MerkleTree, { checkProof, checkProofOrdered,
  merkleRoot, checkProofSolidityFactory, checkProofOrderedSolidityFactory
} from "../../node_modules/merkle-tree-solidity/js/merkle"
*/

function MerkleTree(elements, preserveOrder) {
  if (!(this instanceof MerkleTree)) {
    return new MerkleTree(elements, preserveOrder)
  }

  // remove empty strings
  this.elements = elements.filter(a => a)

  // check buffers
  if (this.elements.some((e) => !(e.length == 32 && Buffer.isBuffer(e)))) {
    throw new Error('elements must be 32 byte buffers')
  }

  // if we are not preserving order, dedup and sort
  this.preserveOrder = !!preserveOrder
  if (!this.preserveOrder) {
    this.elements = bufDedup(this.elements)
    this.elements.sort(Buffer.compare)
  }

  this.layers = getLayers(this.elements, this.preserveOrder)
}

MerkleTree.prototype.getRoot = function() {
  return this.layers[this.layers.length - 1][0]
}

MerkleTree.prototype.getProof = function(element, hex) {
  const index = getBufIndex(element, this.elements)
  if (index == -1) {
    throw new Error('element not found in merkle tree')
  }
  return getProof(index, this.layers, hex)
}

// Expects 1-n index, converts it to 0-n index internally
MerkleTree.prototype.getProofOrdered = function(element, index, hex) {
  if (!(element.equals(this.elements[index - 1]))) {
    throw new Error('element does not match leaf at index in tree')
  }
  return getProof(index - 1, this.layers, hex)
}

const checkProofOrdered = function(proof, root, element, index) {
  // use the index to determine the node ordering
  // index ranges 1 to n

  let tempHash = element

  for (let i = 0; i < proof.length; i++) {
    let remaining = proof.length - i

    // we don't assume that the tree is padded to a power of 2
    // if the index is odd then the proof will start with a hash at a higher
    // layer, so we have to adjust the index to be the index at that layer
    while (remaining && index % 2 === 1 && index > Math.pow(2, remaining)) {
      index = Math.round(index / 2)
    }

    if (index % 2 === 0) {
      tempHash = combinedHash(proof[i], tempHash, true)
    } else {
      tempHash = combinedHash(tempHash, proof[i], true)
    }
    index = Math.round(index / 2)
  }

  return tempHash.equals(root)
}

const checkProof = function(proof, root, element) {
  return root.equals(proof.reduce((hash, pair) => {
    return combinedHash(hash, pair)
  }, element))
}

const merkleRoot = function(elements, preserveOrder) {
  return (new MerkleTree(elements, preserveOrder)).getRoot()
}

// converts buffers from MerkleRoot functions into hex strings
// merkleProof is the contract abstraction for MerkleProof.sol
const checkProofSolidityFactory = function(checkProofContractMethod) {
  return function(proof, root, hash) {
    proof = '0x' + proof.map(e => e.toString('hex')).join('')
    root = bufToHex(root)
    hash = bufToHex(hash)
    return checkProofContractMethod(proof, root, hash)
  }
}

const checkProofOrderedSolidityFactory = function(checkProofOrderedContractMethod) {
  return function(proof, root, hash, index) {
    proof = '0x' + proof.map(e => e.toString('hex')).join('')
    root = bufToHex(root)
    hash = bufToHex(hash)
    return checkProofOrderedContractMethod(proof, root, hash, index)
  }
}

export default MerkleTree
export { checkProof, checkProofOrdered, merkleRoot, checkProofSolidityFactory,
  checkProofOrderedSolidityFactory
}

function combinedHash(first, second, preserveOrder) {
  if (!second) { return first }
  if (!first) { return second }
  if (preserveOrder) {
    return sha3(bufJoin(first, second))
  } else {
    return sha3(bufSortJoin(first, second))
  }
}

function getNextLayer(elements, preserveOrder) {
  return elements.reduce((layer, element, index, arr) => {
    if (index % 2 == 0) { layer.push(combinedHash(element, arr[index + 1], preserveOrder)) }
    return layer
  }, [])
}

function getLayers(elements, preserveOrder) {
  if (elements.length == 0) {
    return [['']]
  }
  const layers = []
  layers.push(elements)
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1], preserveOrder))
  }
  return layers
}

function getProof(index, layers, hex) {
  const proof = layers.reduce((proof, layer) => {
    let pair = getPair(index, layer)
    if (pair) { proof.push(pair) }
    index = Math.floor(index / 2)
    return proof
  }, [])
  if (hex) {
    return '0x' + proof.map(e => e.toString('hex')).join('')
  } else {
    return proof
  }
}

function getPair(index, layer) {
  let pairIndex = index % 2 ? index - 1 : index + 1
  if (pairIndex < layer.length) {
    return layer[pairIndex]
  } else {
    return null
  }
}

function getBufIndex(element, array) {
  for (let i = 0; i < array.length; i++) {
    if (element.equals(array[i])) { return i }
  }
  return -1
}

function bufToHex(element) {
  return Buffer.isBuffer(element) ? '0x' + element.toString('hex') : element
}

function bufJoin(...args) {
  return Buffer.concat([...args])
}

function bufSortJoin(...args) {
  return Buffer.concat([...args].sort(Buffer.compare))
}

function bufDedup(buffers) {
  return buffers.filter((buffer, i) => {
    return getBufIndex(buffer, buffers) == i
  })
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

describe('GuessingGame', () => {
  const {BN} = web3.utils;
  let owner;
  let verifier;
  let contract;
  let contractAddr;
  let txCost;
  let accounts;
  
  function computeElements() {
    const numbers = Array.apply(null, {length: 1024}).map(Number.call, Number);
    return numbers.map(number => {
      var layer = Buffer.alloc(32, 0);
      layer.writeInt32BE(number, 32 - 4);
      return layer;
    });
  }
  
  const elements = computeElements();

  const merkleTree = new MerkleTree(elements);
  const root = merkleTree.getRoot();

  const price = new BN('2').mul(new BN('10').pow(new BN('18')));


  const balanceOf = async (client) => new BN(await web3.eth.getBalance(client));
  function toBytes32(something) {
      return "0x" + something.toString('hex');
  }

  const addTransactionCost = async(receipt) => {
      txCost = new BN('0');
      const tx = await web3.eth.getTransaction(receipt.transactionHash);
      txCost = txCost.add(new BN(receipt.gasUsed).mul(new BN(tx.gasPrice)));
    };


  before(async () => {
    accounts = await web3.eth.getAccounts();
    [owner, verifier] = accounts;
  });

  beforeEach(async () => {
    const args = [];
    contract = await deployContract(web3, guessingGameJson, owner, args, price);
    contractAddr = contract.options.address;
    //console.log("0x" + root.toString('hex'));
    await contract.methods.provideRoot(toBytes32(root)).send({from: verifier});
  });

  it('should be deployed successfully', async () => {
    const {address} = contract.options;
    expect(address).to.not.be.null;
  });

  describe('contract basic', async() => {

    beforeEach(async() => {
      await contract.methods.guessNumber(0).send({from: owner});
    });

    it ('proof should work', async() => {
      const proof = merkleTree.getProof(elements[0]);
      const hexProof = '0x'+Buffer.concat(proof).toString('hex');
      //console.log(hexProof);
      before = await balanceOf(verifier);
      let tx = await contract.methods.provideProof(hexProof).send({from: verifier});
      after = await balanceOf(verifier);
      await addTransactionCost(tx);
      expect(after.sub(before)).to.be.eq.BN(price.sub(txCost));
    });

    it ("proof should't work", async() => {
      const proof = merkleTree.getProof(elements[1]);
      const hexProof = '0x'+Buffer.concat(proof).toString('hex');
      await expectThrow(contract.methods.provideProof(hexProof).send({from: verifier}));
    });

    it ("withdraw shouldnt work", async() => {
      await expectThrow(contract.methods.withdrawPrice().send({from: owner}));
      await expectThrow(contract.methods.withdrawPrice().send({from: verifier}));
    });


    it ("withdraw should work", async() => {
      await waitNBlocks(257);
      before = await balanceOf(owner);
      let tx = await contract.methods.withdrawPrice().send({from: owner});
      after = await balanceOf(owner);
      await addTransactionCost(tx);
      expect(after.sub(before)).to.be.eq.BN(price.sub(txCost));
    });

  });


    describe('checking states', async() => {

      beforeEach(async() => {
        const proof = merkleTree.getProof(elements[0]);
        const hexProof = '0x'+Buffer.concat(proof).toString('hex');
        await expectThrow(contract.methods.provideProof(hexProof).send({from: verifier}));
        await contract.methods.guessNumber(0).send({from: owner});
      });

      it ("withdraw shouldnt work", async() => {
        await expectThrow(contract.methods.withdrawPrice().send({from: owner}));
        await expectThrow(contract.methods.withdrawPrice().send({from: verifier}));
      });

    });


});
