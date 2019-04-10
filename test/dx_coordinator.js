const DxMgnPool = artifacts.require("DxMgnPool")
const Coordinator = artifacts.require("Coordinator")
const DutchExchange = artifacts.require("DutchExchange")
const TokenFRT = artifacts.require("TokenFRT")
const { increaseTimeBy } = require("./utilities")



const abi = require("ethereumjs-abi")

const MockContract = artifacts.require("MockContract")

contract("Coordinator", (accounts) => {
  describe("participateInAuction()", () => {
    it("updates auctionCount and cummulative shares after tiggering from Coordinator", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

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

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      assert.equal(await coordinator.canParticipate.call(), true)
    })

    it("False - no auction scheduled", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock =  100

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(0)

      assert.equal(await coordinator.canParticipate.call(), false)
    })
    it("False - not the right state", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock =  0

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(0)

      assert.equal(await coordinator.canParticipate.call(), false)
    })
  })
})