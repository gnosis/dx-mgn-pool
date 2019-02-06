pragma solidity ^0.5.0;

import './DxMgnPool.sol';
contract Coordinator {

    DxMgnPool public dxMgnPool1;
    DxMgnPool public dxMgnPool2;

    constructor (
        ERC20 _depositToken, 
        ERC20 _secondaryToken, 
        TokenFRT _mgnToken, 
        IDutchExchange _dx,
        uint _poolingPeriodEndBlockNumber
    ) public {
        dxMgnPool1 = new DxMgnPool(_depositToken, _secondaryToken, _mgnToken, _dx, _poolingPeriodEndBlockNumber);
        dxMgnPool2 = new DxMgnPool(_secondaryToken, _depositToken, _mgnToken, _dx, _poolingPeriodEndBlockNumber);
    }

    function participateInAuction() public {
        dxMgnPool1.participateInAuction();
        dxMgnPool2.participateInAuction();
    }
}
