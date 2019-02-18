/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")
const { Gastimator } = require("./gasStation")
const priceUrl = require("../gas-config")
const GasStation = new Gastimator()

// Use price feed based on current network (if listed) else rinkeby.
const url = priceUrl[process.env.NETWORK] || priceUrl.rinkeby

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.deployed()
    console.log("Coordinator deployed at %s", coordinator.address)
    if (await coordinator.canParticipate()) {
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
    }
    callback()
  } catch (error) {
    callback(error)
  }
}
