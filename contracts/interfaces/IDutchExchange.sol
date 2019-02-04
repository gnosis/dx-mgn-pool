pragma solidity ^0.5.0;
import "@gnosis.pm/mock-contract/contracts/MockContract.sol";

contract IDutchExchange {
    mapping(address => mapping(address => mapping(uint => mapping(address => uint)))) public sellerBalances;
    mapping(address => mapping(address => mapping(uint => mapping(address => uint)))) public buyerBalances;
    mapping(address => mapping(address => mapping(uint => mapping(address => uint)))) public claimedAmounts;
    mapping(address => mapping(address => uint)) public balances;

	function deposit(address tokenAddress, uint amount) public returns (uint);
    function ethToken() public returns(address);
    function getAuctionIndex(address token1, address token2) public returns(uint256);
    function postBuyOrder(address token1, address token2, uint256 auctionIndex, uint256 amount) public returns(uint256);
    function postSellOrder(address token1, address token2, uint256 auctionIndex, uint256 tokensBought) public returns(uint256, uint256);
    function getCurrentAuctionPrice(address token1, address token2, uint256 auctionIndex) public view returns(uint256, uint256);
    function claimSellerFunds(address sellToken, address buyToken, address user, uint auctionIndex)
        public
        returns (
        // < (10^60, 10^61)
        uint returned,
        uint frtsIssued
    );
}