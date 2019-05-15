/* eslint-disable no-console */

const Debug = require("debug")
const debug = Debug("DEBUG-participate")

const assert = require("assert")
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const { Gastimator } = require("./gasStation")
const gasPriceUrl = require("../gas-config")
const GasStation = new Gastimator()

async function participateInAuction(coordinatorAddress, network) {
  const debugAuction = Debug("DEBUG-participate:" + coordinatorAddress)
  const infoAuction = Debug("INFO-participate:" + coordinatorAddress)

  debugAuction("Do participate in auction")
  try {
    const coordinator = await Coordinator.at(coordinatorAddress)
    if (await coordinator.canParticipate.call()) {
      // Use price feed based on current network (if listed) else rinkeby.    
      const url = gasPriceUrl[network]
      const fastPrice = (await GasStation.estimateGas(url)).fast

      // Send transaction with fast gas price estimate
      const result = await coordinator.participateInAuction({
        "gasPrice": fastPrice
      })

      infoAuction("Successfully called participateInAuction! in tx: %s", result.tx)
    } else {
      debugAuction("Can't participate in auction yet.")
      const pool1 = await DxMgnPool.at(await coordinator.dxMgnPool1())
      const pool2 = await DxMgnPool.at(await coordinator.dxMgnPool2())

      const pool1State = (await pool1.updateAndGetCurrentState.call()).toNumber()
      const pool2State = (await pool2.updateAndGetCurrentState.call()).toNumber()

      if (pool1State === 1 || pool2State === 1) {
        await claimMgnAndTokens({ debugAuction, pool1, pool2 })
      }
    }
    return null
  } catch (error) {
    console.error(error)
    return error
  }
}

async function claimMgnAndTokens({ pool1, pool2, debugAuction }) {
  const depositToken = await pool1.depositToken()
  const secondaryToken = await pool1.secondaryToken()

  const dx1 = await DutchExchange.at(await pool1.dx())
  const dx2 = await DutchExchange.at(await pool2.dx())

  const lastAuction1 = (await pool1.lastParticipatedAuctionIndex()).toNumber()
  const lastAuction2 = (await pool2.lastParticipatedAuctionIndex()).toNumber()

  const dxAuctionIndex1 = (await dx1.getAuctionIndex.call(depositToken, secondaryToken)).toNumber()
  const dxAuctionIndex2 = (await dx2.getAuctionIndex.call(secondaryToken, depositToken)).toNumber()

  if (dxAuctionIndex1 > lastAuction1) {
    debugAuction("Pool 1: Transitioning state to `DepositWithdrawnFromDx`")
    await pool1.triggerMGNunlockAndClaimTokens()
  }
  if (dxAuctionIndex2 > lastAuction2) {
    debugAuction("Pool 2: Transitioning state to `DepositWithdrawnFromDx`")
    await pool2.triggerMGNunlockAndClaimTokens()
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


    debug("Participate in auction for %d pools: %s", coordinatorAddresses.length, coordinatorAddresses.join(", "))

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
    console.error("Some pools had an error")
    callback(result)
  } else {
    debug("Done!")
    callback()
  }
}
