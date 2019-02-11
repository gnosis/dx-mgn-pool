const DxMgnPool = artifacts.require("DxMgnPool")
const Coordinator = artifacts.require("Coordinator")
const DutchExchange = artifacts.require("DutchExchange")
const TokenFRT = artifacts.require("TokenFRT")

const abi = require("ethereumjs-abi")

const MockContract = artifacts.require("MockContract")

const truffleAssert = require("truffle-assertions")

contract("Coordinator", (accounts) => {
  describe("participateInAuction()", () => {
    it("updates auctionCount and cummulative shares after tiggering from Coordinator", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const instance1 = await DxMgnPool.at(await coordinator.dxMgnPool1.call())
      const instance2 = await DxMgnPool.at(await coordinator.dxMgnPool2.call())

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      await coordinator.participateInAuction()

      assert.equal(await instance1.auctionCount.call(), 1)
      assert.equal(await instance2.auctionCount.call(), 1)
    })
  })

  describe("canParticipate()", () => {
    it("True", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      assert.equal(await coordinator.canParticipate(), true)
    })

    it("False - no auction scheduled", async () => {
      await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock =  100
      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(0)

      assert.equal(await coordinator.canParticipate(), false)
    })
    it("False - not the right state", async () => {
      await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock =  0
      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      assert.equal(await coordinator.canParticipate(), false)
    })
  })
})