const deployWETH = require('@gnosis.pm/util-contracts/src/migrations-truffle-5')


module.exports = async (deployer, network, accounts) => {
  if (network === 'development') {
    const deployParams = {
      artifacts,
      deployer,
      network,
      accounts,
      web3
    }
    await deployWETH(deployParams)
  } else {
    throw new Error('Migrations are just for development. Current network is %s', network)
  }
}