pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IDutchExchange.sol";


contract DxMgnPool {
    struct Participation {
        uint startAuctionCount; // how many auction passed when this participation started contributing
        uint poolShares; // number of shares this participation accounts for (absolute)
        uint amount; // Amount of depostTokens in this participation
    }

    mapping (address => Participation[]) public participationsByAddress;
    uint public totalPoolShares = 0;
    uint public totalPoolSharesCummulative = 0;
    uint public totalDeposit = 0;
    uint public totalMgn = 0;
    uint public lastParticipatedAuctionIndex = 0;
    uint public auctionCount = 0;
    
    ERC20 public depositToken;
    ERC20 public secondaryToken;
    ERC20 public mgnToken;
    IDutchExchange public dx;

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
            poolShares: poolShares,
            amount: amount
        });
        participationsByAddress[msg.sender].push(participation);
        totalPoolShares += poolShares;
        totalDeposit += amount;

        require(depositToken.transferFrom(msg.sender, address(this), amount), "Failed to transfer deposit");
    }

    function participateInAuction() public {
        require(!poolingEnded(), "Pooling period is over.");

        uint auctionIndex = dx.getAuctionIndex(address(depositToken), address(secondaryToken));
        require(auctionIndex > lastParticipatedAuctionIndex, "Has to wait for new auction to start");

        // ... super call into trader to participate in next auction

        lastParticipatedAuctionIndex = auctionIndex;
        auctionCount += 1;
        totalPoolSharesCummulative += totalPoolShares;
    }

    /**
     * Public View Functions
     */
    function numberOfParticipations(address addr) public view returns (uint) {
        return participationsByAddress[addr].length;
    }

    function participationAtIndex(address addr, uint index) public view returns (uint, uint, uint) {
        Participation memory participation = participationsByAddress[addr][index];
        return (participation.startAuctionCount, participation.poolShares, participation.amount);
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

    function poolingEnded() private view returns (bool) {
        return block.number > poolingPeriodEndBlockNumber;
    }
}
