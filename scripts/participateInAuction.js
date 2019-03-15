/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
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
      let fastPrice = 20000000000  // 20 GWei
      try {
        fastPrice = (await GasStation.estimateGas(url)).fast
      } catch (error) {
        console.error("GasPrice etimate failed: Using default fast price of 20 GWei.")
      }
      // Send transaction with fast gas price estimate
      await coordinator.participateInAuction({ "gasPrice" : fastPrice })
      console.log("Successfully called participateInAuction!")
    } else {
      console.log("Can't participate in auction yet.")
      const pool1 = await DxMgnPool.at(await coordinator.dxMgnPool1())
      const pool2 = await DxMgnPool.at(await coordinator.dxMgnPool2())

      const pool1State = (await pool1.currentState()).toNumber()
      if (pool1State == 1) {
        await pool1.triggerMGNunlockAndClaimTokens()
        await pool2.triggerMGNunlockAndClaimTokens()
      } else if (pool1State == 2) {
        await pool1.withdrawUnlockedMagnoliaFromDx()
        await pool2.withdrawUnlockedMagnoliaFromDx()
      }
      if ((await pool1.currentState()).toNumber() > pool1State) {
        console.log("Pooling state transitioned from {}", pool1State)
      }
    }
    callback()
  } catch (error) {
    console.error(error)
    callback(error)
  }
}
