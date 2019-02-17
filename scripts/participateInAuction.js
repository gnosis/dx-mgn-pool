/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")
const { Gastimator } = require("./gas_station")

const GasStation = new Gastimator()

const url = "https://safe-relay.rinkeby.gnosis.pm/api/v1/gas-station/"

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.deployed()
    console.log("Coordinator deployed at %s", coordinator.address)
    if (await coordinator.canParticipate()) {
      const gasPriceEstimates = await GasStation.estimateGas(url)
      // Send transaction with fast gas price estimate
      await coordinator.participateInAuction({ "gasPrice": gasPriceEstimates["fast"] })
      console.log("Successfully called participateInAuction!")
    } else {
      console.log("Can't participate in auction yet.")
    }
    callback()
  } catch (error) {
    callback(error)
  }
}
