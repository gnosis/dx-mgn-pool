const Coordinator = artifacts.require("Coordinator")

module.exports = async (callback) => {
  try {
    const arguments = await process.argv.slice(4)
    if (arguments.length != 1) {
      callback("Error: This script requires arguments - <CoordinatorAddress>")
    }

    const coordinator = await Coordinator.at(arguments[0])

    if (await coordinator.canParticipate()) {
      await coordinator.participateInAuction()
      callback("Successfully called participateInAuction!")
    } else {
      callback("Can't participat in auction yet.")  
    }
    
  } catch (error) {
    callback(error)
  }
}
