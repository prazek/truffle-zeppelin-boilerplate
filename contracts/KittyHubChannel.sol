pragma solidity ^0.4.23;

//import "zeppelin-solidity/contracts/ECRecovery.sol"

library ECRecovery {

  /**
   * @dev Recover signer address from a message by using his signature
   * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
   * @param sig bytes signature, the signature is generated using web3.eth.sign()
   */
  function recover(bytes32 hash, bytes sig) public pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    //Check the signature length
    if (sig.length != 65) {
      return (address(0));
    }

    // Divide the signature in r, s and v variables
    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := byte(0, mload(add(sig, 96)))
    }

    // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
    if (v < 27) {
      v += 27;
    }

    // If the version is correct return the signer address
    if (v != 27 && v != 28) {
      return (address(0));
    } else {
      return ecrecover(hash, v, r, s);
    }
  }


 /**
   * toEthSignedMessageHash
   * @dev prefix a bytes32 value with "\x19Ethereum Signed Message:"
   * @dev and hash the result
   */
  function toEthSignedMessageHash(bytes32 hash)
    internal
    pure
    returns (bytes32)
  {
    // 32 is the length in bytes of hash,
    // enforced by the type signature above
    return keccak256(
      "\x19Ethereum Signed Message:\n32",
      hash
    );
  }
}


// File: zeppelin-solidity/contracts/math/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Substracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

// File: zeppelin-solidity/contracts/ownership/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}



contract KittyHubChannel is Ownable {
    using SafeMath for uint256;

    struct ClosingChannelInfo {
        bool locked;
        uint64 viewedKitties;
        uint256 closingTime;
    }

    uint256 constant public KITTY_VIEW_PRICE = 1 szabo;


    mapping (address => uint256) public allocatedFunds;
    mapping (address => ClosingChannelInfo) public closingChannelInfo;
    uint256 public ownerWithdrawableFunds;
    uint256 public disputeNumBlocks;


    constructor(uint256 _disputeNumBlocks) public Ownable() {
        ownerWithdrawableFunds = 0;
        disputeNumBlocks = _disputeNumBlocks;
    }


    function () public payable {
        addFunds();
    }

    function addFunds() public payable {
        allocatedFunds[msg.sender] = allocatedFunds[msg.sender].add(msg.value);
    }

     function prepareMessageToSign(address channelOwner, uint256 currentAmount) public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            "MultiChannel update",
            bytes32(currentAmount),
            bytes32(channels[channelOwner].startedBlockNumber),
            address(this)));
    }

    function checkReceit(address user, uint64 declaredViewedKitties, bytes receit) pure returns(bool) {

        bytes32 message = prepareMessageToSign(channelOwner, currentAmount);
        bytes32 ethSignedHash = ECRecovery.toEthSignedMessageHash(message);
        address signer = ECRecovery.recover(ethSignedHash, sig);

        require(signer == channelOwner);

        //address signer = ECRecovery.recover(receit);

        //return signer == user;
    }

    function check(address channelOwner, uint256 currentAmount, bytes sig) public
            view
            onlyClosingChannel(channelOwner)
    {
        Channel storage channel = channels[channelOwner];

        require(currentAmount <= channel.currentAmount);


    }

    modifier receitCorrect(address user, uint64 declaredViewedKitties, bytes receit) {
        require(checkReceit(user, declaredViewedKitties, receit), "Incorect receit");
        _;
    }

    function isChannelLocked(address user) public view returns(bool){
        return closingChannelInfo[user].locked;
    }

    modifier channelLocked(address user) {
        require(isChannelLocked(user), "Must call closeChannel before");
        _;
    }

    modifier channelNotLocked(address user) {
        require(!isChannelLocked(user), "Channel is already locked");
        _;
    }

    function didDisputeTimePassed(address user) public view returns(bool) {
        return closingChannelInfo[user].closingTime + disputeNumBlocks <= block.number;
    }

    modifier disputeTimeNotPassed(address user) {
        require(!didDisputeTimePassed(user),
                "dispute time passed");
        _;
    }

    modifier disputeTimePassed(address user) {
        require(didDisputeTimePassed(user), "dispute time not passed");
        _;
    }


    function closeChannel(address user, uint64 declaredViewedKitties, bytes receit)
            public channelNotLocked(user) receitCorrect(user, declaredViewedKitties, receit) {

        require(KITTY_VIEW_PRICE.mul(declaredViewedKitties) <= allocatedFunds[user]);

        closingChannelInfo[user].locked = true;
        closingChannelInfo[user].closingTime = block.number;
        closingChannelInfo[user].viewedKitties = declaredViewedKitties;
    }

    function provideBetterReceit(address user, uint64 declaredViewedKitties, bytes receit)
            public channelLocked(user) disputeTimeNotPassed(user) receitCorrect(user, declaredViewedKitties, receit) {

        require(closingChannelInfo[user].viewedKitties < declaredViewedKitties);
        closingChannelInfo[user].viewedKitties = declaredViewedKitties;
    }

    function withdrawClosedChannel(address user) public channelLocked(user) disputeTimePassed(user) {

        uint256 usedFunds = KITTY_VIEW_PRICE.mul(closingChannelInfo[user].viewedKitties);
        ownerWithdrawableFunds = ownerWithdrawableFunds.add(usedFunds);
        uint256 rest = allocatedFunds[user].sub(usedFunds);

        allocatedFunds[user] = 0;
        closingChannelInfo[user].viewedKitties = 0;
        closingChannelInfo[user].locked = false;
        closingChannelInfo[user].closingTime = 0;

        user.transfer(rest);
    }

    function withdrawUsersFunds() public onlyOwner {
        uint256 fundsToWithdraw = ownerWithdrawableFunds;
        ownerWithdrawableFunds = 0;
        owner.transfer(fundsToWithdraw);
    }

}