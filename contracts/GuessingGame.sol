pragma solidity ^0.4.18;

/*
 * @title MerkleProof
 * @dev Merkle proof verification
 * @note Based on https://github.com/ameensol/merkle-tree-solidity/blob/master/src/MerkleProof.sol
 */
library MerkleProof {
  /*
   * @dev Verifies a Merkle proof proving the existence of a leaf in a Merkle tree. Assumes that each pair of leaves
   * and each pair of pre-images is sorted.
   * @param _proof Merkle proof containing sibling hashes on the branch from the leaf to the root of the Merkle tree
   * @param _root Merkle root
   * @param _leaf Leaf of Merkle tree
   */
  function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf) public pure returns (bool) {
    // Check if proof length is a multiple of 32
    if (_proof.length % 32 != 0) {
      return false;
    }

    bytes32 proofElement;
    bytes32 computedHash = _leaf;

    for (uint256 i = 32; i <= _proof.length; i += 32) {
      assembly {
        // Load the current element of the proof
        proofElement := mload(add(_proof, i))
      }

      if (computedHash < proofElement) {
        // Hash(current computed hash + current element of the proof)
        computedHash = keccak256(computedHash, proofElement);
      } else {
        // Hash(current element of the proof + current computed hash)
        computedHash = keccak256(proofElement, computedHash);
      }
    }

    // Check if the computed hash (root) is equal to the provided root
    return computedHash == _root;
  }
}



contract GuessingGame {
    address public guesser;
    address public verifier;
    bytes32 public root;
    uint256 public gameStartedBlock;
    uint256 public guess;
    
    enum GameState {
        Initialized,
        Started,
        WaitingForProof
    }
    
    GameState public gameState;
    
    constructor() public payable {
        require(msg.value == 2 ether);
        guesser = msg.sender;
    }
    
    modifier inState(GameState state) {
        require(gameState == state);
        _;
    }
    
    
    function provideRoot(bytes32 _root) public inState(GameState.Initialized) {
        root = _root;
        verifier = msg.sender;
        gameStartedBlock = block.number;
        gameState = GameState.Started;
    }
    
    modifier onlyGuesser {
        require(msg.sender == guesser);
        _;
    }
    
    modifier onlyVerifier {
        require(msg.sender == verifier);
        _;
    }
    
    modifier stillInGame {
        require(block.number < gameStartedBlock + 256);
        _;
    }
    
    function guessNumber(uint256 _guess) public onlyGuesser inState(GameState.Started) stillInGame {
        guess = _guess;
        gameState = GameState.WaitingForProof;
    }
    
    function provideProof(bytes proof) public onlyVerifier inState(GameState.WaitingForProof) stillInGame {
        require(proof.length == 10 * 32, "Merke tree should have 1024 leafs, so proof should have height 10");
        require(MerkleProof.verifyProof(proof, root, bytes32(guess)));
        selfdestruct(verifier);
    }
    
    function bailOut() public onlyGuesser inState(GameState.Initialized) {
        selfdestruct(guesser);
    }
    
    modifier gameFinished {
        require(gameState == GameState.WaitingForProof);
        require(block.number > gameStartedBlock + 256);
        _;
    }
    
    
    function withdrawPrice() public onlyGuesser gameFinished {
        selfdestruct(guesser);
    }
}
