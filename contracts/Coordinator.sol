pragma solidity ^0.5.0;

import './DxMgnPool.sol';
contract Coordinator {

    DxMgnPool public dxMgnPool1;
    DxMgnPool public dxMgnPool2;

    constructor (
        ERC20 _token1, 
        ERC20 _token2, 
        TokenFRT _mgnToken, 
        IDutchExchange _dx,
        uint _poolingPeriodEndBlockNumber
    ) public {
        dxMgnPool1 = new DxMgnPool(_token1, _token2, _mgnToken, _dx, _poolingPeriodEndBlockNumber);
        dxMgnPool2 = new DxMgnPool(_token2, _token1, _mgnToken, _dx, _poolingPeriodEndBlockNumber);
    }

    function participateInAuction() public {
        dxMgnPool1.participateInAuction();
        dxMgnPool2.participateInAuction();
    }

    function canParticipate() public view returns (bool) {
        uint auctionIndex = dxMgnPool1.dx().getAuctionIndex(
            address(dxMgnPool1.depositToken()),
            address(dxMgnPool1.secondaryToken())
        );
        // Since both auctions start at the same time, it suffices to check one.
        return auctionIndex > dxMgnPool1.lastParticipatedAuctionIndex() && uint(dxMgnPool1.currentState()) == 0;
    }

}
