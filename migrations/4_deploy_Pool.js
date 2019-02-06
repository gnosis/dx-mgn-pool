const TRADING_PERIOD_IN_HOURS = 30*24


module.exports = async (deployer, web3) => { // eslint-disable-line no-unused-vars
  const Coordinator = artifacts.require('Coordinator')
  const DXProxy = artifacts.require('@gnosis.pm/dx-contracts/contracts/DutchExchange.sol')
  const DXMGN = artifacts.require('@gnosis.pm/dx-contracts/contracts/TokenFRT.sol')
  const WETH = artifacts.require('@gnosis.pm/util-contracts/contracts/EtherToken.sol')
  const GNO = artifacts.require('@gnosis.pm/gno-token/contracts/TokenGNO.sol')

  const dxProxy = await DXProxy.deployed()
  const dxMGN = await DXMGN.deployed()
  const wETH = await WETH.deployed()
  const sGNO = await GNO.deployed()

  //To be changed to time: time is better since all the other dao stuff also depends on timestamps
  //const now = new Date()
  // const endingTradingTimestamp =  new Date(now.getTime() + TRADING_PERIOD_IN_HOURS * 60 * 60 * 1000).getTime() 
  const endingTradingTimestamp  =  2000000;

  await deployer.deploy(Coordinator, wETH.address, sGNO.address, dxMGN.address, dxProxy.address, endingTradingTimestamp)
}