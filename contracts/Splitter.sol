pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract Splitter {
    using SafeMath for uint256;

    address public feeCollector;
    address[] public beneficiaries;
    uint256 public constant FEE = 1 finney;

    event FeeCollected(address indexed collector, uint amount);
    event TokensSplitted(ERC20 indexed token, address indexed sender, uint tokenAmount);

    constructor(address[] _beneficiaries, address _feeCollector) public {
        require(_feeCollector != address(0));
        feeCollector = _feeCollector;
        beneficiaries = _beneficiaries;
    }

    modifier checkBeneficiaries(address[] _beneficiaries) {
        require(_beneficiaries.length > 1);
        for (uint i = 0; i < _beneficiaries.length; i++) {
            address beneficiarie = _beneficiaries[i];
            require(beneficiarie != address(0));
        }
        _;
    }

    modifier feeSend() {
        require(msg.value == FEE);
        _;
    }
    // Approve token amount before calling this function.
    function split(ERC20 tokenAddress, uint tokenAmount) public payable feeSend {
        uint256 splittedAmount = tokenAmount.div(beneficiaries.length);
        uint256 amountToSend = splittedAmount.mul(beneficiaries.length);

        require(tokenAddress.transferFrom(msg.sender, address(this), amountToSend));
        splitTransfered(tokenAddress);
    }

    // Use only when you accidentally sent tokens with transfer instead of approve.
    function splitTransfered(ERC20 tokenAddress) public payable feeSend {
        emit TokensSplitted(tokenAddress, msg.sender, tokenAmount);
        uint256 tokenAmount = tokenAddress.balanceOf(address(this));

        uint256 splittedAmount = tokenAmount.div(beneficiaries.length);
        require(splittedAmount > 0);
        for (uint i = 0; i < beneficiaries.length; i++) {
            // This could be approve, but it would make it difficult to find out what tokens got splitted.
            require(tokenAddress.transfer(beneficiaries[i], splittedAmount));
        }
    }

    modifier onlyFeeCollector() {
        require(msg.sender == feeCollector);
        _;
    }

    function withdrawFee() public onlyFeeCollector {
        withdrawFee(address(this).balance);
    }

    function withdrawFee(uint256 amount) public onlyFeeCollector {
        emit FeeCollected(feeCollector, amount);
        feeCollector.transfer(amount);
    }
}

