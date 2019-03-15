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

      const pool1State = (await pool1.updateAndGetCurrentState.call()).toNumber()
      const pool2State = (await pool2.updateAndGetCurrentState.call()).toNumber()
      try {
        console.log("Attempting to transition state to `DepositWithdrawnFromDx`")
        if (pool1State == 1) {
          await pool1.triggerMGNunlockAndClaimTokens()
        }
        if (pool2State == 1) {
          await pool2.triggerMGNunlockAndClaimTokens()
        }
      } catch (error) {
        console.log("Can't update state: Last auction still running")
      }

    }
    callback()
  } catch (error) {
    console.error(error)
    callback(error)
  }
}
