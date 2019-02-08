pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDutchExchange.sol";
import "@gnosis.pm/dx-contracts/contracts/TokenFRT.sol";


contract DxMgnPool is Ownable {
    using SafeMath for uint;

    struct Participation {
        uint startAuctionCount; // how many auction passed when this participation started contributing
        uint poolShares; // number of shares this participation accounts for (absolute)
        bool withdrawn; // flag indicating whether the participation has been withdrawn
    }

    enum State {
        Pooling,
        PoolingEnded,
        MgnUnlocked
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
    TokenFRT public mgnToken;
    IDutchExchange public dx;

    uint public poolingPeriodEndBlockNumber;

    constructor (
        ERC20 _depositToken, 
        ERC20 _secondaryToken, 
        TokenFRT _mgnToken, 
        IDutchExchange _dx,
        uint _poolingPeriodEndBlockNumber
    ) public Ownable()
    {
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
            startAuctionCount: isDepositTokenTurn() ? auctionCount : auctionCount + 1,
            poolShares: poolShares,
            withdrawn: false
        });
        participationsByAddress[msg.sender].push(participation);
        totalPoolShares += poolShares;
        totalDeposit += amount;

        require(depositToken.transferFrom(msg.sender, address(this), amount), "Failed to transfer deposit");
    }

    function withdrawDeposit() public {
        require(currentState() != State.Pooling, "Pooling period is not over, yet");
        
        uint totalDepositAmount = 0;
        Participation[] storage participations = participationsByAddress[msg.sender];
        for (uint i = 0; i < participations.length; i++) {
            totalDepositAmount += calculateClaimableDeposit(participations[i]);
            participations[i].withdrawn = true;
        }
        require(depositToken.transfer(msg.sender, totalDepositAmount), "Failed to transfer deposit");
    }

    function withdrawMagnolia() public {
        require(currentState() == State.MgnUnlocked, "MGN has not been unlocked, yet");

        uint totalMgnClaimed = 0;
        Participation[] memory participations = participationsByAddress[msg.sender];
        for (uint i = 0; i < participations.length; i++) {
            require(participations[i].withdrawn, "Withdraw deposits first");
            totalMgnClaimed += calculateClaimableMgn(participations[i]);
        }
        delete participationsByAddress[msg.sender];
        require(mgnToken.transfer(msg.sender, totalMgnClaimed), "Failed to transfer MGN");
    }

    function participateInAuction() public  onlyOwner() {
        require(currentState() == State.Pooling, "Pooling period is over.");

        uint auctionIndex = dx.getAuctionIndex(address(depositToken), address(secondaryToken));
        require(auctionIndex > lastParticipatedAuctionIndex, "Has to wait for new auction to start");

        (address sellToken, address buyToken) = buyAndSellToken();
        uint depositAmount = depositToken.balanceOf(address(this));
        if (isDepositTokenTurn() && depositAmount > 0) {
            //depositing new tokens
            depositToken.approve(address(dx), depositAmount);
            dx.deposit(address(depositToken), depositAmount);
        }

        if (lastParticipatedAuctionIndex != 0)
        {
            address(dx).call(abi.encodeWithSignature("claimSellerFunds(address,address,address,uint256)", buyToken, sellToken, address(this), lastParticipatedAuctionIndex));
        }

        uint amount = dx.balances(address(sellToken), address(this));
        if (isDepositTokenTurn()) {
            totalDeposit = amount;
        }

        (lastParticipatedAuctionIndex, ) = dx.postSellOrder(sellToken, buyToken, 0, amount);
        auctionCount += 1;
        totalPoolSharesCummulative += totalPoolShares;
    }

    function triggerMGNunlockAndClaimTokens() public {
        require(currentState() == State.PoolingEnded, "Pooling period is not yet over.");
        require(
            dx.getAuctionIndex(address(depositToken), address(secondaryToken)) > lastParticipatedAuctionIndex, 
            "Last auction is still running"
        );
        
        (address sellToken, address buyToken) = buyAndSellToken();
        address(dx).call(abi.encodeWithSignature("claimSellerFunds(address,address,address,uint256)", buyToken, sellToken, address(this), lastParticipatedAuctionIndex));
        mgnToken.unlockTokens();
        totalDeposit = dx.balances(address(depositToken), address(this));
        if(totalDeposit > 0){
            dx.withdraw(address(depositToken), totalDeposit);
        }
    }

    function withdrawUnlockedMagnoliaFromDx() public {
        require(currentState() == State.PoolingEnded, "Pooling period is not yet over.");
        
        mgnToken.withdrawUnlockedTokens();
        totalMgn = mgnToken.balanceOf(address(this));
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
            return totalPoolShares.mul(amount) / totalDeposit;
        }
    }
    
    function calculateClaimableMgn(Participation memory participation) private view returns (uint) {
        uint duration = auctionCount - participation.startAuctionCount;
        return totalMgn.mul(participation.poolShares).mul(duration) / totalPoolSharesCummulative;
    }

    function calculateClaimableDeposit(Participation memory participation) private view returns (uint) {
        if (participation.withdrawn) {
            return 0;
        }
        return totalDeposit.mul(participation.poolShares) / totalPoolShares;
    }

    function isDepositTokenTurn() private view returns (bool) {
        return auctionCount % 2 == 0;
    }

    function currentState() private view returns (State) {
        if (block.number >= poolingPeriodEndBlockNumber && isDepositTokenTurn()) {
            return totalMgn > 0 ? State.MgnUnlocked : State.PoolingEnded;
        }
        return State.Pooling;
    }

    function buyAndSellToken() private view returns(address buyToken, address sellToken) {
        if (isDepositTokenTurn()) {
            return (address(depositToken), address(secondaryToken));
        } else {
            return (address(secondaryToken), address(depositToken)); 
        }
    }}
