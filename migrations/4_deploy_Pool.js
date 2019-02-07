const TRADING_PERIOD_IN_HOURS = 30*24
let Web3 = require('web3');

module.exports = async (deployer, network, web3) => { // eslint-disable-line no-unused-vars
  const Coordinator = artifacts.require('Coordinator')
  const DXProxy = artifacts.require('@gnosis.pm/dx-contracts/contracts/DutchExchange.sol')
  const DXMGN = artifacts.require('@gnosis.pm/dx-contracts/contracts/TokenFRT.sol')
  const WETH = artifacts.require('@gnosis.pm/util-contracts/contracts/EtherToken.sol')
  const GNO = artifacts.require('@gnosis.pm/gno-token/contracts/TokenGNO.sol')

  let EtherToken, TokenGNO, dxProxy, dxMGN;
  const contract = require('truffle-contract')
  if(network == 'development') {
    EtherToken = await WETH.deployed()
    TokenGNO = await GNO.deployed()
    dxProxy = await DXProxy.deployed()
    dxMGN = await DXMGN.deployed()
  }else {
    dxProxy = contract(require('@gnosis.pm/dx-contracts/build/contracts/DutchExchangeProxy'))
    dxProxy.setProvider(deployer.provider)
    dxMGN = contract(require('@gnosis.pm/dx-contracts/build/contracts/TokenFRT'))
    dxMGN.setProvider(deployer.provider)
    EtherToken = contract(require('@gnosis.pm/util-contracts/build/contracts/EtherToken'))
    EtherToken.setProvider(deployer.provider)
    TokenGNO = contract(require('@gnosis.pm/gno-token/build/contracts/TokenGNO'))
    TokenGNO.setProvider(deployer.provider)
  }
  //To be changed to time: time is better since all the other dao stuff also depends on timestamps
  //const now = new Date()
  // const endingTradingTimestamp =  new Date(now.getTime() + TRADING_PERIOD_IN_HOURS * 60 * 60 * 1000).getTime() 
  const poolingEndBlock = 3829876 + 10000

  await deployer.deploy(Coordinator, EtherToken.address, TokenGNO.address, dxMGN.address, dxProxy.address, poolingEndBlock)
}