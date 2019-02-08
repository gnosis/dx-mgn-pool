/* global artifacts, web3 */
/* eslint no-undef: "error" */


const deployUtils = require('@gnosis.pm/util-contracts/src/migrations-truffle-5')
const deployGno = require('@gnosis.pm/gno-token/src/migrations-truffle-5')
const deployOwl = require('@gnosis.pm/owl-token/src/migrations-truffle-5')

const migrationsDx = require('@gnosis.pm/dx-contracts/src/migrations-truffle-5')

module.exports = async (deployer, network, accounts) => {
  if (network === 'development') {
    const deployParams = {
      artifacts,
      deployer,
      network,
      accounts,
      web3,
      initialTokenAmount: process.env.GNO_TOKEN_AMOUNT,
      gnoLockPeriodInHours: process.env.GNO_LOCKING_PERIOD || 1000,
      thresholdNewTokenPairUsd: process.env.THRESHOLD_NEW_TOKEN_PAIR || 5,
      thresholdAuctionStartUsd: process.env.THRESHOLD_NEW_AUCTION_START || 5
    }

    await deployUtils(deployParams)
    await deployGno(deployParams)
    await deployOwl(deployParams)
    await migrationsDx(deployParams)
  } else {
    throw new Error('Migrations are just for development. Current network is %s', network)
  }
}