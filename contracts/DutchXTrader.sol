pragma solidity ^0.5.2;

import "@gnosis.pm/dx-contracts/contracts/DutchExchange.sol";
import "@gnosis.pm/dx-contracts/contracts/DxDevDependencies.sol";

contract DutchXTrader {

	DutchExchange public dx;

	constructor(DutchExchange _dx) public {
        dx = _dx;
    }
}