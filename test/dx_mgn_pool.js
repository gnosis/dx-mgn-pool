const DxMgnPool = artifacts.require("DxMgnPool")
const ERC20 = artifacts.require("ERC20")
const IDutchX = artifacts.require("IDutchExchange")
const MockContract = artifacts.require('MockContract')

const truffleAssert = require('truffle-assertions');

contract("DxMgnPool", (accounts) => {
  describe("deposit()", () => {
    it("adds a particpation", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, 0)

      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)

      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 1)
      const participation = await instance.participationAtIndex.call(accounts[0], 0)
      assert.equal(participation[1], 10)
      assert.equal(participation[2], 10)

      assert.equal(await instance.totalDeposit.call(), 10)
      assert.equal(await instance.totalPoolShares.call(), 10)
    })
    it("fails if transfer fails", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, 0)

      await depositTokenMock.givenAnyReturnBool(false)
      await dxMock.givenAnyReturnUint(42)

      await truffleAssert.reverts(instance.deposit(10), "Failed to transfer deposit")
    })
    it("address can deposit multiple times", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, 0)

      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)
      await instance.deposit(20)

      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 2)
      const participation = await instance.participationAtIndex.call(accounts[0], 1)
      assert.equal(participation[1], 20)
      assert.equal(participation[2], 20)

      assert.equal(await instance.totalDeposit.call(), 30)
      assert.equal(await instance.totalPoolShares.call(), 30)
    })
  })

  describe("participateInAuction()", () => {
    it("updates auctionCount and cummulative shares", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 1)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 10)
    })
    it("fails if pooling period is over", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) - 1
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await truffleAssert.reverts(instance.participateInAuction(), "Pooling period is over")
    })
    it("cannot participate twice with same auction id", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)
      await instance.participateInAuction()

      await truffleAssert.reverts(instance.participateInAuction(),  "Has to wait for new auction to start")
    })
    it("can participate in consecutive auction", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)
      await instance.participateInAuction()

      await instance.deposit(20)
      await dxMock.givenAnyReturnUint(43)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 2)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 40) // 2 * 10 from first deposit + 1 * 20 from second
    })
  })
})