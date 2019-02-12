const deployWETH = require("../src/migrations/migrations-truffle-5/3_deploy_WETH")

module.exports = async (deployer, network, accounts) =>
  deployWETH({
    artifacts,
    deployer,
    network,
    accounts,
    web3,
  })
