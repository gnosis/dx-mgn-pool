const DxMgnPool = artifacts.require("DxMgnPool")
const TokenFRT = artifacts.require("TokenFRT")

const Coordinator = artifacts.require("Coordinator")

const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")
const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")
const EtherToken = artifacts.require("EtherToken")

const truffleAssert = require("truffle-assertions")
const { waitForNBlocks, timeTravel, timestamp, increaseTimeBy } = require("./utilities")
const BN = web3.utils.BN


contract("e2e - tests", (accounts) => {
  it("adds a particpation and deposits them into first auction", async () => {
    const secondaryTokenMock = await MockContract.new()
    const mgnTokenMock = await MockContract.new()
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)
    const mgnToken = await TokenFRT.at(await dx.frtToken.call())
    const depositToken = await EtherToken.at(await dx.ethToken.call())
    const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100

    const coordinator = await Coordinator.new(depositToken.address, secondaryTokenMock.address, mgnToken.address, dx.address, poolingEndBlock)

    const instance1 = await DxMgnPool.at(await coordinator.dxMgnPool1.call())

    // do the necessary fundings
    const oneEth = new BN("1000000000000000000")
    const oneGwei = new BN("10000000000000000")
    await depositToken.deposit({ value: oneEth })
    await depositToken.approve(instance1.address, oneEth)
    await depositToken.approve(dx.address, oneEth)

    await secondaryTokenMock.givenAnyReturnBool(true)

    await instance1.deposit(10)
    assert.equal(await instance1.numberOfParticipations.call(accounts[0]), 1)

    //frist tokenPair needs to be funded first...
    await dx.deposit(depositToken.address, oneGwei.mul(new BN("5")).toString())
    await dx.deposit(secondaryTokenMock.address, oneGwei.mul(new BN("5")).toString())
    await dx.addTokenPair(
      depositToken.address,
      secondaryTokenMock.address,
      oneGwei.toString(),
      oneGwei.toString(),
      1,
      1
    )
    // ensure that sells go into auction 2, as auction 1 will have been started
    await increaseTimeBy(60 * 60 * 6)
    console.log(await timestamp())
    await coordinator.participateInAuction()

    assert.equal(await dx.sellerBalances.call(depositToken.address, secondaryTokenMock.address, 2, instance1.address), 10)
    assert.equal(await dx.sellerBalances.call(secondaryTokenMock.address, depositToken.address, 2, instance1.address), 0)

    //closes auction 1
    await waitUntilPriceIsXPercentOfPreviousPrice(depositToken, secondaryTokenMock, 1);
    await dx.postBuyOrder(depositToken.address, secondaryTokenMock.address, 1, oneGwei.toString())
    await dx.postBuyOrder(secondaryTokenMock.address, depositToken.address, 1, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(depositToken.address, secondaryTokenMock.address),2)

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(depositToken.address, secondaryTokenMock.address, accounts[0], 1)
    await dx.claimSellerFunds(secondaryTokenMock.address, depositToken.address, accounts[0], 1)
    await dx.claimBuyerFunds(depositToken.address, secondaryTokenMock.address, accounts[0], 1)
    await dx.claimBuyerFunds(secondaryTokenMock.address, depositToken.address, accounts[0], 1)
    await dx.postSellOrder(depositToken.address, secondaryTokenMock.address, 0, oneGwei.toString())
    await dx.postSellOrder(secondaryTokenMock.address, depositToken.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(depositToken, secondaryTokenMock, 1);
    await dx.postBuyOrder(depositToken.address, secondaryTokenMock.address, 2, oneGwei.toString())
    await dx.postBuyOrder(secondaryTokenMock.address, depositToken.address, 2, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(depositToken.address, secondaryTokenMock.address),3)
    console.log("got second auction finished")
    await coordinator.participateInAuction()

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(depositToken.address, secondaryTokenMock.address, accounts[0], 2)
    await dx.claimSellerFunds(secondaryTokenMock.address, depositToken.address, accounts[0], 2)
    await dx.claimBuyerFunds(depositToken.address, secondaryTokenMock.address, accounts[0], 2)
    await dx.claimBuyerFunds(secondaryTokenMock.address, depositToken.address, accounts[0], 2)
    await dx.postSellOrder(depositToken.address, secondaryTokenMock.address, 0, oneGwei.toString())
    await dx.postSellOrder(secondaryTokenMock.address, depositToken.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(depositToken, secondaryTokenMock, 0.9999);
    await dx.postBuyOrder(depositToken.address, secondaryTokenMock.address, 3, oneGwei.toString())
    await dx.postBuyOrder(secondaryTokenMock.address, depositToken.address, 3, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(depositToken.address, secondaryTokenMock.address),4)
    console.log("got third auction finished")

    // end pool trading period:
    await waitForNBlocks(100, accounts[0])

    await instance1.triggerMGNunlockAndClaimTokens()
    
    console.log("could withdraw balance")
    const balBefore = await depositToken.balanceOf.call(accounts[0]);
    await instance1.withdrawDeposit()
    const balAfter = await depositToken.balanceOf.call(accounts[0]);

    assert.equal(balAfter.sub(balBefore).toString(), 9);
  })
})


const waitUntilPriceIsXPercentOfPreviousPrice = async (ST, BT, p) => {
  const dxProxy = await DXProxy.deployed()
  const dx = await DX.at(dxProxy.address)
  const [getAuctionIndex, getAuctionStart] = await Promise.all([
    dx.getAuctionIndex.call(ST.address, BT.address),
    dx.getAuctionStart.call(ST.address, BT.address)
  ])
  const currentIndex = getAuctionIndex.toNumber()
  const startingTimeOfAuction = getAuctionStart.toNumber()
  const priceBefore = 1
  const timeToWaitFor = Math.ceil((86400 - p * 43200) / (1 + p)) + startingTimeOfAuction
  // wait until the price is good
  await increaseTimeBy(timeToWaitFor - await timestamp())
  assert.equal(await timestamp() >= timeToWaitFor, true)
  // assert.isAtLeast(priceAfter, (priceBefore / 2) * p)
}
