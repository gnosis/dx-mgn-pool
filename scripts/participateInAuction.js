/* eslint-disable no-console */
const assert = require("assert")
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const { Gastimator } = require("./gasStation")
const gasPriceUrl = require("../gas-config")
const GasStation = new Gastimator()

async function participateInAuction(coordinatorAddress, network) {
  console.log("[%s] Do articipate in auction", coordinatorAddress)
  try {
    const coordinator = await Coordinator.at(coordinatorAddress)
    if (await coordinator.canParticipate.call()) {
      // Use price feed based on current network (if listed) else rinkeby.    
      const url = gasPriceUrl[network]
      const fastPrice = (await GasStation.estimateGas(url)).fast

      // Send transaction with fast gas price estimate
      await coordinator.participateInAuction({ "gasPrice": fastPrice })
      console.log("[%s] Successfully called participateInAuction!", coordinatorAddress)
    } else {
      console.log("[%s] Can't participate in auction yet.", coordinatorAddress)
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
        console.log("[%s] Pool 1: Transitioning state to `DepositWithdrawnFromDx`", coordinatorAddress)
        await pool1.triggerMGNunlockAndClaimTokens()
      }
      if (pool2State == 1 && dxAuctionIndex2 > lastAuction2) {
        console.log("[%s] Pool 2: Transitioning state to `DepositWithdrawnFromDx`", coordinatorAddress)
        await pool2.triggerMGNunlockAndClaimTokens()
      }
    }
    return null
  } catch (error) {
    console.error(error)
    return error
  }
}

module.exports = async (callback) => {
  let result
  try {
    // Get the network, and all the coordinator addresses
    const network = process.env.NETWORK
    assert(network, "NETWORK env is mandarory")
    let count = 0
    const coordinatorAddresses = []
    do {
      count++
      const envName = "COORDINATOR_ADDRESS_" + count
      const address = process.env[envName]
      assert(address, envName + " is mandatory")

      coordinatorAddresses.push(address)
    } while (process.env["COORDINATOR_ADDRESS_" + (count + 1)])


    console.log("Participate in auction for %d pools: %s", coordinatorAddresses.length, coordinatorAddresses.join(", "))

    // Participate in the auction for all the coordinators
    const participationPromises = coordinatorAddresses
      .map(async coordinatorAddress => participateInAuction(coordinatorAddress, network))

    // Wait for all the participations
    const results = await Promise.all(participationPromises)

    // Check if any participartion returned an error, return the first one  
    result = results.find(result => result !== null)
  } catch (error) {
    result = error
  }

  if (result) {
    console.log("Some pools had an error")
    callback(result)
  } else {
    console.log("Done!")
    callback()
  }
}
