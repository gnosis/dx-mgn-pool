/* eslint-disable no-console */
const Coordinator = artifacts.require("Coordinator")

module.exports = async (callback) => {
  try {
    const coordinator = await Coordinator.deployed()
    console.log("Coordinator deployed at %s", coordinator.address)
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
