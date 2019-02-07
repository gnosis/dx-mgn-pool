const MintableERC20 = artifacts.require("ERC20Mintable.sol")
const EtherToken = artifacts.require("EtherToken")
const TokenFRT = artifacts.require("TokenFRT")

const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")
const Coordinator = artifacts.require("Coordinator")
const DxMgnPool = artifacts.require("DxMgnPool")

const { waitUntilPriceIsXPercentOfPreviousPrice } = require("./dx_e2e")
const { waitForNBlocks, increaseTimeBy } = require("./utilities")

const eth = (amount) => (new web3.utils.BN("1000000000000000000")).mul(new web3.utils.BN(amount)).toString()

const ROUNDS = 100 // has to be even
const BLOCKS_PER_ROUND = 20 // This is a guestimate

contract.only("simulation", (accounts) => {
  it("compute difference between actual and computed MGN gain", async () => {
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)

    const mgnToken = await TokenFRT.at(await dx.frtToken.call())
    const ethToken = await EtherToken.at(await dx.ethToken.call())
    const gnoToken = await MintableERC20.new()
    
    const poolingEndBlock = await web3.eth.getBlockNumber() + (ROUNDS * BLOCKS_PER_ROUND)
    const coordinator = await Coordinator.new(ethToken.address, gnoToken.address, mgnToken.address, dx.address, poolingEndBlock)
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
    }

    console.log(`Creating Auction`)
    await dx.deposit(ethToken.address, eth(1000))
    await dx.deposit(gnoToken.address, eth(1000))
    await dx.addTokenPair(ethToken.address, gnoToken.address, eth(1), eth(1), 1, 1)

    // exclude the account that is doing the buying
    const buyer = accounts[0]
    accounts = accounts.slice(1)
    for (let i = 0; i < ROUNDS; i++) {
      console.log(`Round ${i}:`)
      await makeRandomDeposit(ethPool, gnoPool, accounts)

      const auctionIndex = await dx.getAuctionIndex(ethToken.address, gnoToken.address)
      if (shouldSkip()) {
        console.log(`  - Skip participation`)
        i-- // we always need an even number of particpations
      } else {
        console.log(`  - Participating`)
        await coordinator.participateInAuction()
      }
      const price = randomPrice()
      console.log(`  - Clearing at price ${price}`)
      await fillAndClearAuctions(dx, ethToken, gnoToken, auctionIndex, price, buyer)
      const newAuctionIndex = await dx.getAuctionIndex(ethToken.address, gnoToken.address)
      assert.equal(newAuctionIndex, auctionIndex.toNumber() + 1)

      const [a, b] = i % 2 ? [ethToken.address, gnoToken.address] : [gnoToken.address, ethToken.address]
      const ethPoolBalance = await dx.sellerBalances(b, a, auctionIndex, ethPool.address)
      const gnoPoolBalance = await dx.sellerBalances(a, b, auctionIndex, gnoPool.address)
      console.log(`  - Cleared! ethPoolBalance: ${ethToDecimal(ethPoolBalance)} gnoPoolBalance: ${ethToDecimal(gnoPoolBalance)}`)
    }

    // claim and withdrawMGN after pool trading has ended
    const blocksToWait = poolingEndBlock - (await web3.eth.getBlockNumber()) + 1
    console.log(`Waiting for ${blocksToWait} blocks`)
    await waitForNBlocks(blocksToWait, buyer)

    await ethPool.triggerMGNunlockAndClaimTokens()
    await gnoPool.triggerMGNunlockAndClaimTokens()
    await increaseTimeBy(60 * 60 * 24)
    await ethPool.withdrawUnlockedMagnoliaFromDx()
    await gnoPool.withdrawUnlockedMagnoliaFromDx()

    for (const i in accounts) {
      await ethPool.withdrawDeposit({from: accounts[i]})
      await gnoPool.withdrawDeposit({from: accounts[i]})
      const ethBalance = await ethToken.balanceOf(accounts[i])
      const gnoBalance = await ethToken.balanceOf(accounts[i])
      console.log(`Account ${i} deltas: ${ethToDecimal(ethBalance) - 1000}ETH, ${ethToDecimal(gnoBalance) - 1000}GNO`)
    }
  })
})

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

const fillAndClearAuctions = async (dx, ethToken, gnoToken, auctionIndex, percentOfPreviousPrice, buyer) => {
  // Fund auctions (in case pool doesn't have enough funds)
  await dx.postSellOrder(ethToken.address, gnoToken.address, auctionIndex, eth(1))
  await dx.postSellOrder(gnoToken.address, ethToken.address, auctionIndex, eth(1))

  await waitUntilPriceIsXPercentOfPreviousPrice(ethToken, gnoToken, percentOfPreviousPrice)

  // make sure we buy it all and then claim our funds
  await dx.postBuyOrder(ethToken.address, gnoToken.address, auctionIndex, eth(1000))
  await dx.postBuyOrder(gnoToken.address, ethToken.address, auctionIndex, eth(1000))
  await dx.claimBuyerFunds(ethToken.address, gnoToken.address, buyer, auctionIndex)
  await dx.claimBuyerFunds(gnoToken.address, ethToken.address, buyer, auctionIndex)
  await dx.claimSellerFunds(gnoToken.address, ethToken.address, buyer, auctionIndex)
  await dx.claimSellerFunds(ethToken.address, gnoToken.address, buyer, auctionIndex)
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