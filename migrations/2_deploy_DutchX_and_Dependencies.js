/* global process, artifacts, web3 */

const deployDutchXAndDeps = require("../src/migrations/migrations-truffle-5/2_deploy_DutchX_and_Dependencies")

module.exports = async (deployer, network, accounts) =>
  deployDutchXAndDeps({
    artifacts,
    deployer, 
    network, 
    accounts,
    web3,
    initialTokenAmount: process.env.GNO_TOKEN_AMOUNT,
    gnoLockPeriodInHours: process.env.GNO_LOCKING_PERIOD || 1000,
    thresholdNewTokenPairUsd: process.env.THRESHOLD_NEW_TOKEN_PAIR || 5,
    thresholdAuctionStartUsd: process.env.THRESHOLD_NEW_AUCTION_START || 5
  })
