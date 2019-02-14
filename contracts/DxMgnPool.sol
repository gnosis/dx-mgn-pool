pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDutchExchange.sol";
import "@gnosis.pm/dx-contracts/contracts/TokenFRT.sol";
import "@daostack/arc/contracts/libs/SafeERC20.sol";


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
        DepositWithdrawnFromDx,
        MgnUnlocked
    }
    State public currentState = State.Pooling;

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

    uint public poolingPeriodEndTime;

    constructor (
        ERC20 _depositToken, 
        ERC20 _secondaryToken, 
        IDutchExchange _dx,
        uint _poolingTimeSeconds
    ) public Ownable()
    {
        depositToken = _depositToken;
        secondaryToken = _secondaryToken;
        dx = _dx;
        mgnToken = TokenFRT(dx.frtToken());
        poolingPeriodEndTime = now + _poolingTimeSeconds;
    }

    /**
     * Public interface
     */
    function deposit(uint amount) public {
        checkForStateUpdate();
        require(currentState == State.Pooling, "Pooling is already over");

        uint poolShares = calculatePoolShares(amount);
        Participation memory participation = Participation({
            startAuctionCount: isDepositTokenTurn() ? auctionCount : auctionCount + 1,
            poolShares: poolShares,
            withdrawn: false
        });
        participationsByAddress[msg.sender].push(participation);
        totalPoolShares += poolShares;
        totalDeposit += amount;

        SafeERC20.safeTransferFrom(address(depositToken), msg.sender, address(this), amount);
    }

    function withdrawDeposit() public {
        require(currentState == State.DepositWithdrawnFromDx || currentState == State.MgnUnlocked, "Funds not yet withdrawn from dx");
        
        uint totalDepositAmount = 0;
        Participation[] storage participations = participationsByAddress[msg.sender];
        for (uint i = 0; i < participations.length; i++) {
            totalDepositAmount += calculateClaimableDeposit(participations[i]);
            participations[i].withdrawn = true;
        }
        SafeERC20.safeTransfer(address(depositToken), msg.sender, totalDepositAmount);
    }

    function withdrawMagnolia() public {
        require(currentState == State.MgnUnlocked, "MGN has not been unlocked, yet");

        uint totalMgnClaimed = 0;
        Participation[] memory participations = participationsByAddress[msg.sender];
        for (uint i = 0; i < participations.length; i++) {
            require(participations[i].withdrawn, "Withdraw deposits first");
            totalMgnClaimed += calculateClaimableMgn(participations[i]);
        }
        delete participationsByAddress[msg.sender];
        SafeERC20.safeTransfer(address(mgnToken), msg.sender, totalMgnClaimed);
    }

    function participateInAuction() public  onlyOwner() {
        checkForStateUpdate();
        require(currentState == State.Pooling, "Pooling period is over.");

        uint auctionIndex = dx.getAuctionIndex(address(depositToken), address(secondaryToken));
        require(auctionIndex > lastParticipatedAuctionIndex, "Has to wait for new auction to start");

        (address sellToken, address buyToken) = sellAndBuyToken();
        uint depositAmount = depositToken.balanceOf(address(this));
        if (isDepositTokenTurn()) {
            totalPoolSharesCummulative += 2 * totalPoolShares;
            if( depositAmount > 0){
                //depositing new tokens
                depositToken.approve(address(dx), depositAmount);
                dx.deposit(address(depositToken), depositAmount);
            }
        }
        // Don't revert if we can't claimSellerFunds
        address(dx).call(abi.encodeWithSignature("claimSellerFunds(address,address,address,uint256)", buyToken, sellToken, address(this), lastParticipatedAuctionIndex));

        uint amount = dx.balances(address(sellToken), address(this));
        if (isDepositTokenTurn()) {
            totalDeposit = amount;
        }

        (lastParticipatedAuctionIndex, ) = dx.postSellOrder(sellToken, buyToken, 0, amount);
        auctionCount += 1;
    }

    function triggerMGNunlockAndClaimTokens() public {
        checkForStateUpdate();
        require(currentState == State.PoolingEnded, "Pooling period is not yet over.");
        require(
            dx.getAuctionIndex(address(depositToken), address(secondaryToken)) > lastParticipatedAuctionIndex, 
            "Last auction is still running"
        );      
        
        // Don't revert if wen can't claimSellerFunds
        address(dx).call(abi.encodeWithSignature("claimSellerFunds(address,address,address,uint256)", secondaryToken, depositToken, address(this), lastParticipatedAuctionIndex));
        mgnToken.unlockTokens();

        uint amountOfFundsInDX = dx.balances(address(depositToken), address(this));
        totalDeposit = amountOfFundsInDX + depositToken.balanceOf(address(this));
        if(totalDeposit > 0){
            dx.withdraw(address(depositToken), amountOfFundsInDX);
        }
        currentState = State.DepositWithdrawnFromDx;
    }

    function withdrawUnlockedMagnoliaFromDx() public {
        require(currentState == State.DepositWithdrawnFromDx, "Unlocking not yet triggered");

        // Implicitly we also have:
        // require(unlockedTokens[msg.sender].withdrawalTime < now, "The tokens cannot be withdrawn yet");

        mgnToken.withdrawUnlockedTokens();
        totalMgn = mgnToken.balanceOf(address(this));

        currentState = State.MgnUnlocked;
    }

    function checkForStateUpdate() public {
        if (now >= poolingPeriodEndTime && isDepositTokenTurn() && currentState == State.Pooling) {
            currentState = State.PoolingEnded;
        }
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

    function sellAndBuyToken() private view returns(address sellToken, address buyToken) {
        if (isDepositTokenTurn()) {
            return (address(depositToken), address(secondaryToken));
        } else {
            return (address(secondaryToken), address(depositToken)); 
        }
    }
}
