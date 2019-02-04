pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IDutchExchange.sol";


contract DxMgnPool {
    struct Participation {
        uint startAuctionId; // dx auction ID this participation started contributing in
        uint poolShares; // number of shares this participation accounts for (absolute)
        uint amount; // Amount of depostTokens in this participation
    }

    mapping (address => Participation[]) private participationsByAddress;
    uint public totalPoolShares = 0;
    uint public totalDeposit = 0;
    ERC20 private depositToken;
    ERC20 private secondaryToken;
    IDutchExchange private dx;

    constructor (ERC20 _depositToken, ERC20 _secondaryToken, IDutchExchange _dx) public {
        depositToken = _depositToken;
        secondaryToken = _secondaryToken;
        dx = _dx;
    }

    /**
     * Public interface
     */
    function deposit(uint amount) public {
        uint poolShares = calculatePoolShares(amount);
        Participation memory participation = Participation({
            startAuctionId: dx.getAuctionIndex(address(depositToken), address(secondaryToken)),
            poolShares: poolShares,
            amount: amount
        });
        participationsByAddress[msg.sender].push(participation);
        totalPoolShares += poolShares;
        totalDeposit += amount;

        require(depositToken.transferFrom(msg.sender, address(this), amount), "Failed to transfer deposit");
    }

    /**
     * Public View Functions
     */
    function numberOfParticipations(address addr) public view returns (uint) {
        return participationsByAddress[addr].length;
    }

    function participationAtIndex(address addr, uint index) public view returns (uint, uint, uint) {
        Participation memory participation = participationsByAddress[addr][index];
        return (participation.startAuctionId, participation.poolShares, participation.amount);
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
}