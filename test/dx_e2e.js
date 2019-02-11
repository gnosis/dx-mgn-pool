const DxMgnPool = artifacts.require("DxMgnPool")
const TokenFRT = artifacts.require("TokenFRT")
const TokenGNO = artifacts.require("TokenGNO")


const Coordinator = artifacts.require("Coordinator")

const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")
const EtherToken = artifacts.require("EtherToken")

const { 
  waitUntilPriceIsXPercentOfPreviousPrice,
  increaseTimeBy } = require("./utilities")
const BN = web3.utils.BN


contract("e2e - tests", (accounts) => {
  it("e2e tests for deposits: 1 deposit - 2x trading - withdraw", async () => {
    const initialFundingGNO = "1111111111111111111111"
    const token_2 = await TokenGNO.new(initialFundingGNO)
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)
    const mgnToken = await TokenFRT.at(await dx.frtToken.call())
    const token_1 = await EtherToken.at(await dx.ethToken.call())
    const poolingTime = (60 * 60 * 6) + 100

    const coordinator = await Coordinator.new(token_1.address, token_2.address, mgnToken.address, dx.address, poolingTime)

    const instance1 = await DxMgnPool.at(await coordinator.dxMgnPool1.call())
    const instance2 = await DxMgnPool.at(await coordinator.dxMgnPool2.call())

    // approving Tokens for MGN generation
    await dx.updateApprovalOfToken([token_1.address, token_2.address], [true, true])
    // do the necessary fundings
    const oneEth = new BN("1000000000000000000")
    const oneGwei = new BN("10000000000000000")
    await token_1.deposit({ value: oneEth })
    await token_1.approve(instance1.address, oneEth)
    await token_1.approve(dx.address, oneEth)

    await  token_2.approve(dx.address, oneEth)
    await  token_2.approve(instance2.address, oneEth)


    const DEPOSIT_1_1 = 10
    const DEPOSIT_2_1 = 200
    await instance1.deposit(DEPOSIT_1_1)
    await instance2.deposit(DEPOSIT_2_1)

    assert.equal(await instance1.numberOfParticipations.call(accounts[0]), 1)
    assert.equal(await instance2.numberOfParticipations.call(accounts[0]), 1)

    //first tokenPair needs to be funded first...
    await dx.deposit(token_1.address, oneGwei.mul(new BN("5")).toString())
    await dx.deposit(token_2.address, oneGwei.mul(new BN("5")).toString())
    await dx.addTokenPair(
      token_1.address,
      token_2.address,
      oneGwei.toString(),
      oneGwei.toString(),
      1,
      1
    )
    // ensure that sells go into auction 2, as auction 1 will have been started
    await increaseTimeBy(60 * 60 * 6, web3)
    await coordinator.participateInAuction()

    assert.equal(await dx.sellerBalances.call(token_1.address, token_2.address, 2, instance1.address), 10)
    assert.equal(await dx.sellerBalances.call(token_2.address, token_1.address, 2, instance1.address), 0)

    //closes auction 1
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 1, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 1, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 1, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 2)

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(token_1.address, token_2.address, accounts[0], 1)
    await dx.claimSellerFunds(token_2.address, token_1.address, accounts[0], 1)
    await dx.claimBuyerFunds(token_1.address, token_2.address, accounts[0], 1)
    await dx.claimBuyerFunds(token_2.address, token_1.address, accounts[0], 1)
    await dx.postSellOrder(token_1.address, token_2.address, 0, oneGwei.toString())
    await dx.postSellOrder(token_2.address, token_1.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 1, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 2, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 2, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 3)
    console.log("got second auction finished")
    await coordinator.participateInAuction()

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(token_1.address, token_2.address, accounts[0], 2)
    await dx.claimSellerFunds(token_2.address, token_1.address, accounts[0], 2)
    await dx.claimBuyerFunds(token_1.address, token_2.address, accounts[0], 2)
    await dx.claimBuyerFunds(token_2.address, token_1.address, accounts[0], 2)
    await dx.postSellOrder(token_1.address, token_2.address, 0, oneGwei.toString())
    await dx.postSellOrder(token_2.address, token_1.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 0.9999, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 3, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 3, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 4)
    console.log("got third auction finished")

    // end pool trading period:
    await increaseTimeBy(100, web3)

    await instance1.triggerMGNunlockAndClaimTokens()
    await instance2.triggerMGNunlockAndClaimTokens()

    let balBefore = await token_1.balanceOf.call(accounts[0])
    await instance1.withdrawDeposit()
    let balAfter = await token_1.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString() - (DEPOSIT_1_1 - 2), 5)

    balBefore = await token_2.balanceOf.call(accounts[0])
    await instance2.withdrawDeposit()
    balAfter = await token_2.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString()- (DEPOSIT_2_1 - 4) , 5)

    //wait until MGN is unlocked
    await increaseTimeBy(60 * 60 * 24 + 2, web3)
    await instance1.withdrawUnlockedMagnoliaFromDx()
    await instance2.withdrawUnlockedMagnoliaFromDx()

    balBefore = await mgnToken.balanceOf.call(accounts[0])
    await instance1.withdrawMagnolia()
    balAfter = await mgnToken.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString() - (2 * DEPOSIT_1_1 - 1), 5)

    balBefore = await mgnToken.balanceOf.call(accounts[0])
    await instance2.withdrawMagnolia()
    balAfter = await mgnToken.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString() - (2 * DEPOSIT_2_1 - 2), 4)
  })
  it("e2e tests for trading pool activity only on one pair: 1 deposit - 2x trading - withdraw", async () => {
    const initialFundingGNO = "1111111111111111111111"
    const token_2 = await TokenGNO.new(initialFundingGNO)
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)
    const mgnToken = await TokenFRT.at(await dx.frtToken.call())
    const token_1 = await EtherToken.at(await dx.ethToken.call())
    const poolingTime = (60 * 60 * 6) + 100

    const coordinator = await Coordinator.new(token_1.address, token_2.address, mgnToken.address, dx.address, poolingTime)

    const instance1 = await DxMgnPool.at(await coordinator.dxMgnPool1.call())

    // approving Tokens for MGN generation
    await dx.updateApprovalOfToken([token_1.address, token_2.address], [true, true])

    // do the necessary fundings
    const oneEth = new BN("1000000000000000000")
    const oneGwei = new BN("10000000000000000")
    await token_1.deposit({ value: oneEth })
    await token_1.approve(instance1.address, oneEth)
    await token_1.approve(dx.address, oneEth)

    await  token_2.approve(dx.address, oneEth)


    const DEPOSIT_1_1 = 10
    await instance1.deposit(DEPOSIT_1_1)

    assert.equal(await instance1.numberOfParticipations.call(accounts[0]), 1)

    //first tokenPair needs to be funded first...
    await dx.deposit(token_1.address, oneGwei.mul(new BN("5")).toString())
    await dx.deposit(token_2.address, oneGwei.mul(new BN("5")).toString())
    await dx.addTokenPair(
      token_1.address,
      token_2.address,
      oneGwei.toString(),
      oneGwei.toString(),
      1,
      1
    )
    // ensure that sells go into auction 2, as auction 1 will have been started
    await increaseTimeBy(60 * 60 * 6, web3)
    await coordinator.participateInAuction()

    assert.equal(await dx.sellerBalances.call(token_1.address, token_2.address, 2, instance1.address), 10)
    assert.equal(await dx.sellerBalances.call(token_2.address, token_1.address, 2, instance1.address), 0)

    //closes auction 1
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 1, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 1, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 1, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 2)

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(token_1.address, token_2.address, accounts[0], 1)
    await dx.claimSellerFunds(token_2.address, token_1.address, accounts[0], 1)
    await dx.claimBuyerFunds(token_1.address, token_2.address, accounts[0], 1)
    await dx.claimBuyerFunds(token_2.address, token_1.address, accounts[0], 1)
    await dx.postSellOrder(token_1.address, token_2.address, 0, oneGwei.toString())
    await dx.postSellOrder(token_2.address, token_1.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 1, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 2, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 2, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 3)
    console.log("got second auction finished")
    await coordinator.participateInAuction()

    //claim funds  and post into next auction auction with more
    await dx.claimSellerFunds(token_1.address, token_2.address, accounts[0], 2)
    await dx.claimSellerFunds(token_2.address, token_1.address, accounts[0], 2)
    await dx.claimBuyerFunds(token_1.address, token_2.address, accounts[0], 2)
    await dx.claimBuyerFunds(token_2.address, token_1.address, accounts[0], 2)
    await dx.postSellOrder(token_1.address, token_2.address, 0, oneGwei.toString())
    await dx.postSellOrder(token_2.address, token_1.address, 0, oneGwei.toString())

    //close the auction and pool paritcpation in next one
    await waitUntilPriceIsXPercentOfPreviousPrice(dx, token_1, token_2, 0.9999, web3)
    await dx.postBuyOrder(token_1.address, token_2.address, 3, oneGwei.toString())
    await dx.postBuyOrder(token_2.address, token_1.address, 3, oneGwei.toString())

    assert.equal(await dx.getAuctionIndex(token_1.address, token_2.address), 4)
    console.log("got third auction finished")

    // end pool trading period:
    await increaseTimeBy(100, web3)

    await instance1.triggerMGNunlockAndClaimTokens()

    let balBefore = await token_1.balanceOf.call(accounts[0])
    await instance1.withdrawDeposit()
    let balAfter = await token_1.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString() - (DEPOSIT_1_1 - 2), 5)

    //wait until MGN is unlocked
    await increaseTimeBy(60 * 60 * 24 + 2, web3)
    await instance1.withdrawUnlockedMagnoliaFromDx()

    balBefore = await mgnToken.balanceOf.call(accounts[0])
    await instance1.withdrawMagnolia()
    balAfter = await mgnToken.balanceOf.call(accounts[0])
    assert.isBelow(balAfter.sub(balBefore).toString() - (2 * DEPOSIT_1_1 - 1), 5)
  })
})
