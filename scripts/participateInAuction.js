/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const { Gastimator } = require("./gasStation")
const priceUrl = require("../gas-config")
const GasStation = new Gastimator()

// Use price feed based on current network (if listed) else rinkeby.
const url = priceUrl[process.env.NETWORK] || priceUrl.rinkeby

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.deployed()
    console.log("Coordinator deployed at %s", coordinator.address)

    if (await coordinator.canParticipate.call()) {
      const fastPrice = (await GasStation.estimateGas(url)).fast

      // Send transaction with fast gas price estimate
      await coordinator.participateInAuction({ "gasPrice": fastPrice })
      console.log("Successfully called participateInAuction!")
    } else {
      console.log("Can't participate in auction yet.")
      const pool1 = await DxMgnPool.at(await coordinator.dxMgnPool1())
      const pool2 = await DxMgnPool.at(await coordinator.dxMgnPool2())

      const pool1State = (await pool1.updateAndGetCurrentState.call()).toNumber()
      const pool2State = (await pool2.updateAndGetCurrentState.call()).toNumber()

      const depositToken = await pool1.depositToken()
      const secondaryToken = await pool1.secondaryToken()

      const dx1 = await DutchExchange.at(await pool1.dx())
      const dx2 = await DutchExchange.at(await pool2.dx())

      const lastAuction1 = (await pool1.lastParticipatedAuctionIndex()).toNumber()
      const lastAuction2 = (await pool2.lastParticipatedAuctionIndex()).toNumber()

      const dxAuctionIndex1 = (await dx1.getAuctionIndex.call(depositToken, secondaryToken)).toNumber()
      const dxAuctionIndex2 = (await dx2.getAuctionIndex.call(secondaryToken, depositToken)).toNumber()

      if (pool1State == 1 && dxAuctionIndex1 > lastAuction1) {
        console.log("Pool 1: Transitioning state to `DepositWithdrawnFromDx`")
        await pool1.triggerMGNunlockAndClaimTokens()
      }
      if (pool2State == 1 && dxAuctionIndex2 > lastAuction2) {
        console.log("Pool 2: Transitioning state to `DepositWithdrawnFromDx`")
        await pool2.triggerMGNunlockAndClaimTokens()
      }
    }
    callback()
  } catch (error) {
    console.error(error)
    callback(error)
  }
}
