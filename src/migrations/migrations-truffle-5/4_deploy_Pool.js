/* eslint-disable no-undef */

// eslint-disable-next-line no-undef
  abi = require("ethereumjs-abi")

// const TRADING_PERIOD_IN_HOURS = 30*24

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

  const poolingTime = 3 * 60 * 60 * 24 // 3 days for testing
    
  await deployer.deploy(Coordinator, etherToken.address, tokenGNO.address, dxProxy.address, poolingTime)
}

module.exports = migrate
