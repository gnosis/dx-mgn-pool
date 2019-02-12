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
    DXMGNArtifact = artifacts.require("@gnosis.pm/dx-contracts/contracts/TokenFRT"),
    WETHArtifact = artifacts.require("@gnosis.pm/util-contracts/contracts/EtherToken"),
    GNOArtifact = artifacts.require("@gnosis.pm/gno-token/contracts/TokenGNO")
  
  const contractArr = [DXProxyArtifact, DXMGNArtifact, WETHArtifact, GNOArtifact]
  
  // temp vars
  let etherToken, tokenGNO, dxProxy, dxMGN  
  
  if (network === "development") {
    ([etherToken, tokenGNO, dxProxy, dxMGN]= await Promise.all([
      WETHArtifact.deployed(),
      GNOArtifact.deployed(),
      DXProxyArtifact.deployed(),
      DXMGNArtifact.deployed(),
    ]))
  } else {
    const TC = require("truffle-contract")
    // we need to setProvider to get correct networks from artifacts
    const contractsMapped = contractArr.map(art => TC(art))
    // Set deployer provider to each contract
    contractsMapped.forEach(tcArt => tcArt.setProvider(deployer.provider));
    
    ([etherToken, tokenGNO, dxProxy, dxMGN]= await Promise.all([
      WETHArtifact.deployed(),
      GNOArtifact.deployed(),
      DXProxyArtifact.deployed(),
      DXMGNArtifact.deployed(),
    ]))
  }

  const poolingTime = 3 * 60 * 60 * 24 // 3 days for testing
  
  // console.log("abi encoded constructor parameters are: ", web3.eth.abi.encodeParameters(['address', 'address', 'address', 'address', 'uint256'], [etherToken.address, tokenGNO.address, dxMGN.address, dxProxy.address, poolingEndBlock]))
  
  await deployer.deploy(Coordinator, etherToken.address, tokenGNO.address, dxMGN.address, dxProxy.address, poolingTime)
}

module.exports = migrate
