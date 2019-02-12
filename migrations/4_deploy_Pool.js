const deployPool = require("../src/migrations/migrations-truffle-5/4_deploy_Pool")

module.exports = async (deployer, network) =>
  deployPool({
    artifacts,
    deployer,
    network,
  })
