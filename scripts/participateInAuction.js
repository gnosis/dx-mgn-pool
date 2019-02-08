/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")

const assert = require("assert")

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.deployed()

    if (await coordinator.canParticipate()) {
      await coordinator.participateInAuction()
      console.log("Successfully called participateInAuction!")
      callback()
    } else {
      console.log("Can't participate in auction yet.")
      callback()  
    }
    
  } catch (error) {
    callback(error)
  }
}
