pragma solidity ^0.4.23;

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
    uint64 constant public DISPUTE_TIME = 1 days;

    mapping (address => uint256) public allocatedFunds;
    mapping (address => ClosingChannelInfo) public closingChannelInfo;
    uint256 ownerWithdrawableFunds;

    constructor() public Ownable() {
        ownerWithdrawableFunds = 0;
    }


    function () public payable {
        addFunds();
    }

    function addFunds() public payable {
        allocatedFunds[msg.sender] = allocatedFunds[msg.sender].add(msg.value);
    }

    function checkReceit(address user, uint64 declaredViewedKitties, bytes receit) pure returns(bool) {
        // TODO:
        return true;
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
        return closingChannelInfo[user].closingTime + DISPUTE_TIME <= now;
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
        closingChannelInfo[user].closingTime = now;
        closingChannelInfo[user].viewedKitties = declaredViewedKitties;
    }

    function provideBetterReceit(address user, uint64 declaredViewedKitties, bytes receit)
        public channelLocked(user) disputeTimeNotPassed(user) receitCorrect(user, declaredViewedKitties, receit) {

        closingChannelInfo[user].viewedKitties = declaredViewedKitties;
    }

    function withdrawClosedChannel() public channelLocked(msg.sender) disputeTimePassed(msg.sender) {

        uint256 usedFunds = KITTY_VIEW_PRICE.mul(closingChannelInfo[msg.sender].viewedKitties);
        ownerWithdrawableFunds = ownerWithdrawableFunds.add(usedFunds);
        uint256 rest = allocatedFunds[msg.sender].sub(usedFunds);

        allocatedFunds[msg.sender] = 0;
        closingChannelInfo[msg.sender].viewedKitties = 0;
        closingChannelInfo[msg.sender].locked = false;
        closingChannelInfo[msg.sender].closingTime = 0;

        msg.sender.transfer(rest);
    }

    function withdrawUsersFunds() public onlyOwner {
        uint256 fundsToWithdraw = ownerWithdrawableFunds;
        ownerWithdrawableFunds = 0;
        owner.transfer(fundsToWithdraw);
    }

}