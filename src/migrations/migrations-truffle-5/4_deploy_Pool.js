/* eslint-disable no-console, no-undef */

abi = require("ethereumjs-abi")


async function migrate({
  artifacts,
  deployer,
  network,
}) {
  if (network === "development" && !process.env.TRADING_END_TIME) {
    process.env.TRADING_END_TIME = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days for testing
  }
  console.log("TRADING_END_TIME ENV: ", process.env.TRADING_END_TIME)

  const Coordinator = artifacts.require("Coordinator"),
    DXProxyArtifact = artifacts.require("@gnosis.pm/dx-contracts/contracts/DutchExchangeProxy"),
    WETHArtifact = artifacts.require("@gnosis.pm/util-contracts/contracts/EtherToken"),
    GNOArtifact = artifacts.require("@gnosis.pm/gno-token/contracts/TokenGNO")

  // temp vars
  let etherToken, tokenGNO, dxProxy

  if (network === "development") {
    ([etherToken, tokenGNO, dxProxy] = await Promise.all([
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

  const poolingTime = _getPoolingTime()
  await deployer.deploy(Coordinator, etherToken.address, tokenGNO.address, dxProxy.address, poolingTime)
}

function _getPoolingTime() {
  let tradingEndTime
  if (process.env.TRADING_END_TIME) {
    tradingEndTime = new Date(Date.parse(process.env.TRADING_END_TIME))
  } else {
    throw new Error("TRADING_END_TIME env is mandatory. i.e. TRADING_END_TIME=\"2019-05-12T12:00:00+02:00\"")
  }

  const now = new Date()
  if (tradingEndTime <= now) {
    throw new Error("The TRADING_END_TIME is incorrect. It should be a future date")
  }
  return Math.floor((tradingEndTime - now) / 1000)
}

module.exports = migrate
