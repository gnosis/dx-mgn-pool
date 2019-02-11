const TRADING_PERIOD_IN_HOURS = 30*24
abi = require('ethereumjs-abi')
module.exports = async (deployer, network) => { // eslint-disable-line no-unused-vars
  const Coordinator = artifacts.require('Coordinator')
  let DXProxy, DXMGN, WETH, GNO

  let EtherToken, TokenGNO, dxProxy, dxMGN;
  const contract = require('truffle-contract')
  if(network == 'development') {
    DXProxy = artifacts.require('@gnosis.pm/dx-contracts/contracts/DutchExchangeProxy.sol')
    DXMGN = artifacts.require('@gnosis.pm/dx-contracts/contracts/TokenFRT.sol')
    WETH = artifacts.require('@gnosis.pm/util-contracts/contracts/EtherToken.sol')
    GNO = artifacts.require('@gnosis.pm/gno-token/contracts/TokenGNO.sol')
  
    etherToken = await WETH.deployed()
    tokenGNO = await GNO.deployed()
    dxProxy = await DXProxy.deployed()
    dxMGN = await DXMGN.deployed()
  } else {
    DxProxy = contract(require('@gnosis.pm/dx-contracts/build/contracts/DutchExchangeProxy'))
    DxProxy.setProvider(deployer.provider)
    DxMGN = contract(require('@gnosis.pm/dx-contracts/build/contracts/TokenFRT'))
    DxMGN.setProvider(deployer.provider)
    EtherToken = contract(require('@gnosis.pm/util-contracts/build/contracts/EtherToken'))
    EtherToken.setProvider(deployer.provider)
    TokenGNO = contract(require('@gnosis.pm/gno-token/build/contracts/TokenGNO'))
    TokenGNO.setProvider(deployer.provider)
    etherToken = await EtherToken.deployed()
    tokenGNO = await TokenGNO.deployed()
    dxProxy = await DxProxy.deployed()
    dxMGN = await DxMGN.deployed()
  }
  const poolingTime = 3 * 60 * 60 * 24 // 3 days for testing
  
  //console.log("abi encoded constructor parameters are: ", web3.eth.abi.encodeParameters(['address', 'address', 'address', 'address', 'uint256'], [etherToken.address, tokenGNO.address, dxMGN.address, dxProxy.address, poolingEndBlock]))
  
  await deployer.deploy(Coordinator, etherToken.address, tokenGNO.address, dxMGN.address, dxProxy.address, poolingTime)
}