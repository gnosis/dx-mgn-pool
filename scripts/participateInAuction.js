/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")

const assert = require("assert")

const coordinatorAddress = process.env.CONTRACT_ADDRESS

assert(coordinatorAddress, "Contract address is required")

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.at(coordinatorAddress)

    if (await coordinator.canParticipate()) {
      await coordinator.participateInAuction()
      console.log("Successfully called participateInAuction!")
      callback()
    } else {
      console.log("Can't participat in auction yet.")
      callback()  
    }
    
  } catch (error) {
    callback(error)
  }
}
