const MintableERC20 = artifacts.require("ERC20Mintable.sol")
const EtherToken = artifacts.require("EtherToken")
const TokenFRT = artifacts.require("TokenFRT")

const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")
const assert = require("chai").assert

const { 
  waitUntilPriceIsXPercentOfPreviousPrice, 
  increaseTimeBy } = require("../test/utilities")

const eth = (amount) => (new web3.utils.BN("1000000000000000000") * amount).toLocaleString("fullwide", { useGrouping: false, maximumFractionDigits: 0 })

const ROUNDS = 100 // has to be even

let totalMgnEthPool = new web3.utils.BN("0")
let totalMgnGnoPool = new web3.utils.BN("0")
const exactMgnMinted = []

module.exports = async (callback) => {
  try {
    let accounts = await web3.eth.getAccounts()
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)

    const mgnToken = await TokenFRT.at(await dx.frtToken.call())
    const ethToken = await EtherToken.at(await dx.ethToken.call())
    const gnoToken = await MintableERC20.new()
    
    const poolingTime = 1000
    const coordinator = await Coordinator.new(ethToken.address, gnoToken.address, mgnToken.address, dx.address, poolingTime)
    const ethPool = await DxMgnPool.at(await coordinator.dxMgnPool1.call())
    const gnoPool = await DxMgnPool.at(await coordinator.dxMgnPool2.call())

    console.log(`Funding accounts & approving contracts`)
    for (const i in accounts) {
      await ethToken.deposit({ value: eth(1000), from: accounts[i] })
      await ethToken.approve(ethPool.address, eth(1000), {from: accounts[i]})
      await ethToken.approve(dx.address, eth(1000), {from: accounts[i]})

      await gnoToken.mint(accounts[i], eth(1000))
      await gnoToken.approve(gnoPool.address, eth(1000), {from: accounts[i]})
      await gnoToken.approve(dx.address, eth(1000), {from: accounts[i]})

      exactMgnMinted.push(new web3.utils.BN("0"))
    }

    console.log(`Creating Auction`)
    await dx.deposit(ethToken.address, eth(1000))
    await dx.deposit(gnoToken.address, eth(1000))
    await dx.addTokenPair(ethToken.address, gnoToken.address, eth(1), eth(1), 1, 1)
    // approving Tokens for MGN generation
    await dx.updateApprovalOfToken([ethToken.address, gnoToken.address], [true, true])

    // exclude the account that is doing the buying
    const buyer = accounts[0]
    accounts = accounts.slice(1)
    for (let i = 0; i < ROUNDS; i++) {
      console.log(`Round ${i}:`)
      await makeRandomDeposit(ethPool, gnoPool, accounts)

      if (shouldSkip()) {
        console.log(`  - Skip participation`)
        i-- // we always need an even number of particpations
      } else {
        console.log(`  - Participating`)
        await coordinator.participateInAuction()
      }
      const price = randomPrice()
      console.log(`  - Clearing at price ${price}`)
      await fillAndClearAuctions(dx, ethPool, gnoPool, ethToken, gnoToken, price, buyer)
      await computeExactMagnolia(dx, ethPool, gnoPool, mgnToken, accounts)
    }

    // claim and withdrawMGN after pool trading has ended
    console.log(`Waiting for ${blocksToWait} blocks`)
    await increaseTimeBy(1000, web3)

    await ethPool.triggerMGNunlockAndClaimTokens()
    await gnoPool.triggerMGNunlockAndClaimTokens()
    await increaseTimeBy(60 * 60 * 25, web3)
    await ethPool.withdrawUnlockedMagnoliaFromDx()
    await gnoPool.withdrawUnlockedMagnoliaFromDx()
    
    let poolMgnBalance = (await mgnToken.balanceOf(ethPool.address)).add(await mgnToken.balanceOf(gnoPool.address))
    console.log(`Total Magnolia claimed: ${ethToDecimal(poolMgnBalance)}`)

    for (const i in accounts) {
      await ethPool.withdrawDeposit({from: accounts[i]})
      await gnoPool.withdrawDeposit({from: accounts[i]})
      await ethPool.withdrawMagnolia({from: accounts[i]})
      await gnoPool.withdrawMagnolia({from: accounts[i]})
      
      const ethBalance = await ethToken.balanceOf(accounts[i])
      const gnoBalance = await ethToken.balanceOf(accounts[i])
      const mgnBalance = await mgnToken.balanceOf(accounts[i])
      const mgnDelta = (ethToDecimal(mgnBalance) - ethToDecimal(exactMgnMinted[i])).toFixed(2)

      console.log(`Account ${i} deltas: ${(ethToDecimal(ethBalance) - 1000).toFixed(2)}ETH, ${(ethToDecimal(gnoBalance) - 1000).toFixed(2)}GNO, ${mgnDelta}MGN (total ${ethToDecimal(mgnBalance)}MGN)`)
    }

    poolMgnBalance = (await mgnToken.balanceOf(ethPool.address)).add(await mgnToken.balanceOf(gnoPool.address))
    console.log(`Magnolia left after claiming: ${ethToDecimal(poolMgnBalance)}`)
    callback()
  } catch (error) {
    callback(error)
  }
}

const makeRandomDeposit = async (ethPool, gnoPool, accounts) => {
  for (const i in accounts) {
    if (shouldDeposit()) {
      const ethAmount = randomDeposit()
      console.log(`  - Account ${i} depositing ${ethAmount}ETH`)
      await ethPool.deposit(eth(ethAmount), {from: accounts[i]})
    }
    if (shouldDeposit()) {
      const gnoAmount = randomDeposit()
      console.log(`  - Account ${i} depositing ${gnoAmount}GNO`)
      await gnoPool.deposit(eth(gnoAmount), {from: accounts[i]})
    }
  }
}

const ethToDecimal = (amount) => amount.div(new web3.utils.BN("10000000000000000")).toNumber() / 100

const fillAndClearAuctions = async (dx, ethPool, gnoPool, ethToken, gnoToken, percentOfPreviousPrice, buyer) => {
  const auctionIndex = await dx.getAuctionIndex(ethToken.address, gnoToken.address)

  // Fund auctions (in case pool doesn't have enough funds)
  await dx.postSellOrder(ethToken.address, gnoToken.address, auctionIndex, eth(1))
  await dx.postSellOrder(gnoToken.address, ethToken.address, auctionIndex, eth(1))

  await waitUntilPriceIsXPercentOfPreviousPrice(dx, ethToken, gnoToken, percentOfPreviousPrice, web3)

  // make sure we buy it all and then claim our funds
  await dx.postBuyOrder(ethToken.address, gnoToken.address, auctionIndex, eth(1000))
  await dx.postBuyOrder(gnoToken.address, ethToken.address, auctionIndex, eth(1000))
  await dx.claimBuyerFunds(ethToken.address, gnoToken.address, buyer, auctionIndex)
  await dx.claimBuyerFunds(gnoToken.address, ethToken.address, buyer, auctionIndex)
  await dx.claimSellerFunds(gnoToken.address, ethToken.address, buyer, auctionIndex)
  await dx.claimSellerFunds(ethToken.address, gnoToken.address, buyer, auctionIndex)

  const newAuctionIndex = await dx.getAuctionIndex(ethToken.address, gnoToken.address)
  assert.equal(newAuctionIndex, auctionIndex.toNumber() + 1)

  const ethPoolEthBalance = await dx.sellerBalances(ethToken.address, gnoToken.address, auctionIndex, ethPool.address)
  const ethPoolGnoBalance = await dx.sellerBalances(gnoToken.address, ethToken.address, auctionIndex, ethPool.address)
  const gnoPoolEthBalance = await dx.sellerBalances(ethToken.address, gnoToken.address, auctionIndex, gnoPool.address)
  const gnoPoolGnoBalance = await dx.sellerBalances(gnoToken.address, ethToken.address, auctionIndex, gnoPool.address)
  console.log(`  - Cleared!`)
  console.log(`    ethPoolBalance: ${ethToDecimal(ethPoolEthBalance)}ETH ${ethToDecimal(ethPoolGnoBalance)}GNO`)
  console.log(`    gnoPoolBalance: ${ethToDecimal(gnoPoolEthBalance)}ETH ${ethToDecimal(gnoPoolGnoBalance)}GNO`)
}

const computeExactMagnolia = async (dx, ethPool, gnoPool, mgnToken, accounts) => {
  const newMgnEthPool = await mgnToken.lockedTokenBalances(ethPool.address)
  const newMgnGnoPool = await mgnToken.lockedTokenBalances(gnoPool.address)
  const mgnEthPoolDifference = newMgnEthPool.sub(totalMgnEthPool)
  const mgnGnoPoolDifference = newMgnGnoPool.sub(totalMgnGnoPool)
  const ethPoolAuctionIndex = await ethPool.auctionCount()
  const gnoPoolAuctionIndex = await gnoPool.auctionCount()
  const ethPoolTotalShares = await ethPool.totalPoolShares()
  const gnoPoolTotalShares = await gnoPool.totalPoolShares()
  for (const i in accounts) {
    const sharesInEthPool = await getAccountSharesInPool(ethPool, ethPoolAuctionIndex, accounts[i])
    if (sharesInEthPool > 0) {
      const newMgn = sharesInEthPool.mul(mgnEthPoolDifference).div(ethPoolTotalShares)      
      exactMgnMinted[i] = exactMgnMinted[i].add(newMgn)
    }

    const sharesInGnoPool = await getAccountSharesInPool(gnoPool, gnoPoolAuctionIndex, accounts[i])
    if (sharesInGnoPool > 0) {
      const newMgn = sharesInGnoPool.mul(mgnGnoPoolDifference).div(gnoPoolTotalShares)
      exactMgnMinted[i] = exactMgnMinted[i].add(newMgn)
    }
  }

  totalMgnEthPool = newMgnEthPool
  totalMgnGnoPool = newMgnGnoPool
}

const getAccountSharesInPool = async(pool, auctionIndex, account) => {
  const numberOfParticipations = await pool.numberOfParticipations(account)
  let sharesForAccount = new web3.utils.BN("0")
  for (let i = 0; i < numberOfParticipations.toNumber(); i++) {
    const indexAndShares = await pool.participationAtIndex(account, i)
    if (indexAndShares[0] < auctionIndex) {
      sharesForAccount = sharesForAccount.add(indexAndShares[1])
    }
  }
  return sharesForAccount
}

const shouldSkip = () => Math.random() < .01 // skip with 1% chance

const shouldDeposit = () => Math.random() < .1 // deposit with 10% chance

const randomDeposit = () => randomNormalDistribution(0, 100, 6.64) // from, 0 to 100 with mean 1ETH

const randomPrice = () => randomNormalDistribution(.8, 1.2, 1) // price moving between 80% and 120%

// Normal Distribution With Min, Max, Skew (https://stackoverflow.com/a/49434653)
const randomNormalDistribution = (min, max, skew) => {
  let u = 0, v = 0
  while(u === 0) u = Math.random() //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random()
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v )

  num = num / 10.0 + 0.5 // Translate to 0 -> 1
  if (num > 1 || num < 0) num = randomNormalDistribution(min, max, skew) // resample between 0 and 1 if out of range
  num = Math.pow(num, skew) // Skew
  num *= max - min // Stretch to fill range
  num += min // offset to min
  return num
}