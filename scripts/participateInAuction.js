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

// const STATE_POOLING = 0 // Pooling
const STATE_POOLING_ENDED = 1 // PoolingEnded
const STATE_UNLOCKING_MGN = 2 // DepositWithdrawnFromDx
// const STATE_MGN_UNLOCKED = 3 // MgnUnlocked

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
      debugAuction("Can't participate in auction")
      const pool1 = await DxMgnPool.at(await coordinator.dxMgnPool1())
      const pool2 = await DxMgnPool.at(await coordinator.dxMgnPool2())

      // Get state of the pools
      const pool1State = (await pool1.updateAndGetCurrentState.call()).toNumber()
      const pool2State = (await pool2.updateAndGetCurrentState.call()).toNumber()

      // Unlock the MGN when it's time
      if (pool1State === STATE_POOLING_ENDED || pool2State === STATE_POOLING_ENDED) {
        debugAuction("Pool period is over. Checking if we can unlock the MGN")
        await unlockMgnAndTokens({
          pool1, pool2, pool1State, pool2State, infoAuction
        })
      }

      // Claim the MGN when it's time
      if (pool1State === STATE_UNLOCKING_MGN || pool2State === STATE_UNLOCKING_MGN) {
        debugAuction("Waiting for the MGN unlock. Checking if we can claim the MGN")

        claimMgn({ poolNumber: 1, pool: pool1, state: pool1State, infoAuction })
        claimMgn({ poolNumber: 2, pool: pool2, state: pool2State, infoAuction })
      }
    }
    return null
  } catch (error) {
    console.error(error)
    return error
  }
}

async function unlockMgnAndTokens({
  pool1, pool2, pool1State, pool2State, infoAuction
}) {
  const depositToken = await pool1.depositToken()
  const secondaryToken = await pool1.secondaryToken()

  const dx1 = await DutchExchange.at(await pool1.dx())
  const dx2 = await DutchExchange.at(await pool2.dx())

  const lastAuction1 = (await pool1.lastParticipatedAuctionIndex()).toNumber()
  const lastAuction2 = (await pool2.lastParticipatedAuctionIndex()).toNumber()

  const dxAuctionIndex1 = (await dx1.getAuctionIndex.call(depositToken, secondaryToken)).toNumber()
  const dxAuctionIndex2 = (await dx2.getAuctionIndex.call(secondaryToken, depositToken)).toNumber()

  const logBeforeMsg = "Pool %d: The period is over. Unlocking MGN (transition to state DepositWithdrawnFromDx: 2)"
  const logAfterMsg = "Pool %d: Successfully called triggerMGNunlockAndClaimTokens! in tx: %s"
  if (pool1State === STATE_POOLING_ENDED && dxAuctionIndex1 > lastAuction1) {
    infoAuction(logBeforeMsg, 1)
    const result = await pool1.triggerMGNunlockAndClaimTokens()
    infoAuction(logAfterMsg, 1, result.tx)
  }
  if (pool2State === STATE_POOLING_ENDED && dxAuctionIndex2 > lastAuction2) {
    infoAuction(logBeforeMsg, 2)
    const result = await pool2.triggerMGNunlockAndClaimTokens()
    infoAuction(logAfterMsg, 2, result.tx)
  }
}


async function claimMgn({
  poolNumber, pool, state, debugAuction, infoAuction
}) {
  debugAuction("Waiting for the MGN unlock. Checking if we can claim the MGN")

  // We could check the expire time easily of the MGN, but we will take the simple approach of
  // executing "withdrawUnlockedMagnoliaFromDx" if the call succeeds

  if (state === STATE_UNLOCKING_MGN) {
    const canClaim = await pool.withdrawUnlockedMagnoliaFromDx.call()
      .then(() => true)
      .catch(() => false)

    if (canClaim) {
      // Dry-run succeeded: Claim Pool 1
      infoAuction("Pool %d: The MGN is unlocked. Claiming MGN (transition to final state DepositWithdrawnFromDx: 3)", poolNumber)
      const result = await pool.withdrawUnlockedMagnoliaFromDx()
      infoAuction("Pool %d: Successfully called withdrawUnlockedMagnoliaFromDx! in tx: %s", poolNumber, result.tx)
    }
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
