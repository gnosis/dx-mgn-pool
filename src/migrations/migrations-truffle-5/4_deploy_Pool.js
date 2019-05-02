/* eslint-disable no-console, no-undef */

abi = require("ethereumjs-abi")

console.log("TRADING PERIOD DAYS ENV? ", process.env.TRADING_PERIOD_DAYS)
console.log("TRADING_END_TIME ENV? ", process.env.TRADING_END_TIME)

var TRADING_PERIOD_IN_HOURS 

if (network === 'development') {
  TRADING_PERIOD_IN_HOURS = (process.env.TRADING_PERIOD_DAYS || 3) * 60 * 60 * 24 // 3 days for testing
}
if (process.env.TRADING_END_TIME) {
  tradingEndTime = new Date(Date.parse(process.env.TRADING_END_TIME))
  currentTime = new Date()
  TRADING_PERIOD_IN_HOURS = Math.floor(Math.abs(tradingEndTime - currentTime) / 36e5)
} else {
  throw new Error(`
    LOCK_END_TIME environment variable is not specified
    It must be in ISO date format, e.g:
    LOCK_END_TIME='2019-06-12T16:00:00+02:00' npm run migrate
    `)
}
console.log(`
TRADING_PERIOD_IN_HOURS: ${TRADING_PERIOD_IN_HOURS}
`)

async function migrate({
  artifacts,
  deployer,
  network,
}) {
  
  const Coordinator = artifacts.require("Coordinator"),
    DXProxyArtifact = artifacts.require("@gnosis.pm/dx-contracts/contracts/DutchExchangeProxy"),
    WETHArtifact = artifacts.require("@gnosis.pm/util-contracts/contracts/EtherToken"),
    GNOArtifact = artifacts.require("@gnosis.pm/gno-token/contracts/TokenGNO")

  // temp vars
  let etherToken, tokenGNO, dxProxy 
  
  if (network === "development") {
    ([etherToken, tokenGNO, dxProxy]= await Promise.all([
      WETHArtifact.deployed(),
      GNOArtifact.deployed(),
      DXProxyArtifact.deployed(),
    ]))
  } else {
    const TC = require("truffle-contract")
    
    const contractArtFilePaths = [
      "@gnosis.pm/dx-contracts/build/contracts/DutchExchangeProxy.json", 
      "@gnosis.pm/util-contracts/build/contracts/EtherToken.json", 
      "@gnosis.pm/gno-token/build/contracts/TokenGNO.json",
    ]

    // we need to setProvider to get correct networks from artifacts
    const contractsMapped = contractArtFilePaths.map(path => TC(require(path)))
    // Set deployer provider to each contract
    contractsMapped.forEach(tcArt => tcArt.setProvider(deployer.provider));
    ([dxProxy, etherToken, tokenGNO] = await Promise.all(contractsMapped.map(contract => contract.deployed())))
  }

  const poolingTime = TRADING_PERIOD_IN_HOURS
    
  await deployer.deploy(Coordinator, etherToken.address, tokenGNO.address, dxProxy.address, poolingTime)
}

module.exports = migrate
