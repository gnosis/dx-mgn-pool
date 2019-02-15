const deployWETH = require("@gnosis.pm/util-contracts/src/migrations-truffle-5")

async function migrate({
  artifacts,
  deployer, 
  network, 
  accounts,
  web3
}) {
  if (network === "development") {
    const deployParams = {
      artifacts,
      deployer,
      network,
      accounts,
      web3
    }
    await deployWETH(deployParams)
  } else {
    console.log("WETH was already deployed, skipping this migration setup")
  }
}

module.exports = migrate
