
module.exports = async (deployer) => { // eslint-disable-line no-unused-vars
  const Trader = artifacts.require('DutchXTrader')
  const DXProxy = artifacts.require('@gnosis.pm/dx-contracts/contracts/DutchExchange.sol')
  
  const dxProxy = await DXProxy.deployed()

  await deployer.deploy(Trader, dxProxy.address)
}