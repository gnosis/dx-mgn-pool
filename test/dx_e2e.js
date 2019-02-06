const DxMgnPool = artifacts.require("DxMgnPool")
const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")
const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")
const EtherToken = artifacts.require("EtherToken")

const truffleAssert = require("truffle-assertions")
const { waitForNBlocks, timeTravel, timestamp } = require("./utilities")
const BN = web3.utils.BN


contract("Trading", (accounts) => {
  it("adds a particpation and deposits them into first auction", async () => {
    const secondaryTokenMock = await MockContract.new()
    const mgnTokenMock = await MockContract.new()
    const dxProxy = await DXProxy.deployed()
    const dx = await DX.at(dxProxy.address)
    const erc20 = await ERC20.new()
    const depositToken = await EtherToken.at(await dx.ethToken.call())

    const instance = await DxMgnPool.new(depositToken.address, secondaryTokenMock.address, mgnTokenMock.address, dx.address, 100000)

    const  oneEth = new BN("1000000000000000000")
    const  oneGwei = new BN("10000000000000000")
    await depositToken.deposit({value: oneEth})
    await depositToken.approve(instance.address, oneEth)
    await depositToken.approve(dx.address, oneEth)

    await secondaryTokenMock.givenAnyReturnBool(true)

    await instance.deposit(10)
    assert.equal(await instance.numberOfParticipations.call(accounts[0]), 1)

    //frist tokenPair needs to be funded first...
    await dx.deposit(depositToken.address, oneGwei.toString())
    await dx.deposit(secondaryTokenMock.address, oneGwei.toString())
    await dx.addTokenPair(
      depositToken.address,
      secondaryTokenMock.address,
      oneGwei.toString(),
      oneGwei.toString(),
      1,
      10
    )
    //  await waitUntilPriceIsXPercentOfPreviousPrice(depositToken, secondaryTokenMock, 1);

    //  await depositTokenMock.givenAnyReturnUint(10)
    //  const balanceOf = erc20.contract.methods.balanceOf(instance.address).encodeABI()
    //  await depositTokenMock.givenMethodReturnUint(balanceOf, 10)
    //  await instance.participateInAuction()

  	  // assert.equal(await dx.sellerBalance.call(DxMgnPool.address, 0), 10)*/
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
  await timeTravel(timeToWaitFor - timestamp())
  assert.equal(timestamp() >= timeToWaitFor, true)
  // assert.isAtLeast(priceAfter, (priceBefore / 2) * p)
}
