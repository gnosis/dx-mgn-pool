pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IDutchExchange.sol";


contract DxMgnPool {

    struct Participation {
        uint startAuctionCount; // how many auction passed when this participation started contributing
        uint poolShares; // number of shares this participation accounts for (absolute)
    }

    mapping (address => Participation[]) public participationsByAddress;
    uint public totalPoolShares = 0; // total number of shares in this pool
    uint public totalPoolSharesCummulative = 0; // over all auctions, the rolling sum of all shares participated
    uint public totalDeposit = 0;
    uint public totalMgn = 0;
    uint public lastParticipatedAuctionIndex = 0;
    uint public auctionCount = 0;
    
    ERC20 public depositToken;
    ERC20 public secondaryToken;
    ERC20 public mgnToken;
    IDutchExchange public dx;

    bool isDepositTokenTurn = true;

    uint public poolingPeriodEndBlockNumber;

    constructor (
        ERC20 _depositToken, 
        ERC20 _secondaryToken, 
        ERC20 _mgnToken, 
        IDutchExchange _dx, 
        uint _poolingPeriodEndBlockNumber
    ) public {
        depositToken = _depositToken;
        secondaryToken = _secondaryToken;
        mgnToken = _mgnToken;
        dx = _dx;
        poolingPeriodEndBlockNumber = _poolingPeriodEndBlockNumber;
    }

    /**
     * Public interface
     */
    function deposit(uint amount) public {
        uint poolShares = calculatePoolShares(amount);
        Participation memory participation = Participation({
            startAuctionCount: auctionCount,
            poolShares: poolShares
        });
        participationsByAddress[msg.sender].push(participation);
        totalPoolShares += poolShares;
        totalDeposit += amount;

        require(depositToken.transferFrom(msg.sender, address(this), amount), "Failed to transfer deposit");
    }

    function withdraw() public {
        require(hasPoolingEnded(), "Pooling period is not over, yet");
        
        uint totalDepositAmount = 0;
        uint totalMgnClaimed = 0;
        Participation[] memory participations = participationsByAddress[msg.sender];
        for (uint i = 0; i < participations.length; i++) {
            totalDepositAmount += calculateClaimableDeposit(participations[i]);
            totalMgnClaimed += calculateClaimableMgn(participations[i]);
        }
        delete participationsByAddress[msg.sender];

        require(depositToken.transfer(msg.sender, totalDepositAmount), "Failed to transfer deposit");
        require(mgnToken.transfer(msg.sender, totalMgnClaimed), "Failed to transfer MGN");
    }

    function participateInAuction() public {
        require(!hasPoolingEnded(), "Pooling period is over.");

        uint auctionIndex = dx.getAuctionIndex(address(depositToken), address(secondaryToken));
        require(auctionIndex > lastParticipatedAuctionIndex, "Has to wait for new auction to start");

        (address sellToken, address buyToken) = buyAndSellToken();
        uint depositAmount = depositToken.balanceOf(address(this));
        if (isDepositTokenTurn && depositAmount > 0){
            //depositng new tokens
            depositToken.approve(address(dx), depositAmount);
            dx.deposit(address(depositToken), depositAmount);
        }

        if (lastParticipatedAuctionIndex != 0) {
            dx.claimSellerFunds(buyToken, sellToken, address(this), lastParticipatedAuctionIndex);
        }

        uint amount = dx.balances(address(sellToken), address(this));
        if (isDepositTokenTurn) {
            totalDeposit = amount;
        }

        (lastParticipatedAuctionIndex, ) = dx.postSellOrder(sellToken, buyToken, 0, amount);
        isDepositTokenTurn = !isDepositTokenTurn;

        auctionCount += 1;
        totalPoolSharesCummulative += totalPoolShares;
    }

    /**
     * Public View Functions
     */
    function numberOfParticipations(address addr) public view returns (uint) {
        return participationsByAddress[addr].length;
    }

    function participationAtIndex(address addr, uint index) public view returns (uint, uint) {
        Participation memory participation = participationsByAddress[addr][index];
        return (participation.startAuctionCount, participation.poolShares);
    }

    /**
     * Internal Helpers
     */
    function calculatePoolShares(uint amount) private view returns (uint) {
        if (totalDeposit == 0) {
            return amount;
        } else {
            return (amount / totalDeposit) * totalPoolShares;
        }
    }
    
    function calculateClaimableMgn(Participation memory participation) private returns (uint) {
        if (totalMgn == 0) {
            totalMgn = mgnToken.balanceOf(address(this));
        }
        uint duration = auctionCount - participation.startAuctionCount;
        return totalMgn * participation.poolShares * duration / totalPoolSharesCummulative;
    }

    function calculateClaimableDeposit(Participation memory participation) private view returns (uint) {
        return totalDeposit * participation.poolShares / totalPoolShares;
    }

    function hasPoolingEnded() private view returns (bool) {
        return block.number > poolingPeriodEndBlockNumber;
    }

    function buyAndSellToken() private view returns(address buyToken, address sellToken) {
        if(isDepositTokenTurn) {
            return (address(depositToken), address(secondaryToken));
        } else {
            return (address(secondaryToken), address(depositToken)); 
        }
    }
}
