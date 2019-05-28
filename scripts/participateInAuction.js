/* eslint-disable no-console */

const Debug = require("debug")
const debug = Debug("DEBUG-participate")

const assert = require("assert")
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
const TokenFRT = artifacts.require("TokenFRT")

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

  debugAuction("Check if it should participate in auction")
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
      debugAuction("It's not time to participate in auction")
      const pool1 = await DxMgnPool.at(await coordinator.dxMgnPool1())
      const pool2 = await DxMgnPool.at(await coordinator.dxMgnPool2())

      // Get state of the pools
      const pool1State = (await pool1.updateAndGetCurrentState.call()).toNumber()
      const pool2State = (await pool2.updateAndGetCurrentState.call()).toNumber()

      // Unlock the MGN when it's time
      if (pool1State === STATE_POOLING_ENDED || pool2State === STATE_POOLING_ENDED) {
        debugAuction("Pool period is over. Checking if we can unlock the MGN")
        const depositToken = await pool1.depositToken()
        const secondaryToken = await pool1.secondaryToken()

        await unlockMgnAndTokens({
          pool: pool1,
          poolState: pool1State,
          depositToken,
          secondaryToken,
          infoAuction,
          debugAuction
        })
        await unlockMgnAndTokens({
          pool: pool2,
          poolState: pool2State,
          depositToken: secondaryToken,
          secondaryToken: depositToken,
          infoAuction,
          debugAuction
        })
      }

      // Claim the MGN when it's time
      if (pool1State === STATE_UNLOCKING_MGN || pool2State === STATE_UNLOCKING_MGN) {
        debugAuction("Waiting for the MGN unlock. Checking if we can claim the MGN")
        const mgn = await TokenFRT.at(await pool1.mgnToken.call())

        await claimMgn({ pool: pool1, state: pool1State, mgn, infoAuction, debugAuction })
        await claimMgn({ pool: pool2, state: pool2State, mgn, infoAuction, debugAuction })
      }
    }
    return null
  } catch (error) {
    console.error("Error executing participateInAuction for " + coordinatorAddress, error)
    return error
  }
}

async function unlockMgnAndTokens({
  pool,
  depositToken,
  secondaryToken,
  poolState,
  infoAuction,
  debugAuction
}) {
  const dx = await DutchExchange.at(await pool.dx())
  const lastAuction = (await pool.lastParticipatedAuctionIndex()).toNumber()
  const dxAuctionIndex = (await dx.getAuctionIndex.call(depositToken, secondaryToken)).toNumber()
  const poolAddress = pool.address

  if (poolState === STATE_POOLING_ENDED) {
    if (dxAuctionIndex > lastAuction) {
      infoAuction("Pool %s: The period is over. Unlocking MGN (transition to state DepositWithdrawnFromDx: 2)", poolAddress)
      const result = await pool.triggerMGNunlockAndClaimTokens()
      infoAuction("Pool %s: Successfully called triggerMGNunlockAndClaimTokens! in tx: %s", poolAddress, result.tx)
    } else {
      debugAuction("Pool %s is over, but still running last auction. Waiting for auction %d to finish", poolAddress, lastAuction)
    }
  } else {
    debugAuction("Pool %s: The pool is not over yet", poolAddress)
  }
}


async function claimMgn({ pool, mgn, state, infoAuction, debugAuction }) {
  if (state === STATE_UNLOCKING_MGN) {
    const unlockedTokens = await mgn.unlockedTokens(pool.address)
    const withdrawalTime = new Date(unlockedTokens.withdrawalTime.toNumber() * 1000)
    const now = new Date()
    const poolAddress = pool.address

    if (now >= withdrawalTime) {
      // Dry-run succeeded: Claim Pool 1
      infoAuction("Pool %s: The MGN is unlocked. Claiming MGN (transition to final state DepositWithdrawnFromDx: 3)", poolAddress)
      const result = await pool.withdrawUnlockedMagnoliaFromDx()
      infoAuction("Pool %s: Successfully called withdrawUnlockedMagnoliaFromDx! in tx: %s", poolAddress, result.tx)
    } else {
      const pendingHours = ((withdrawalTime - now) / 3600000).toFixed(1)
      debugAuction("Pool %s: The MGN is not unlocked yet. We need to wait %d hours", poolAddress, pendingHours)
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
