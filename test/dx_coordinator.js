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

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      assert.equal(await coordinator.canParticipate(), true)
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

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(0)

      assert.equal(await coordinator.canParticipate(), false)
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

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(0)

      assert.equal(await coordinator.canParticipate(), false)
    })
  })
  describe("withdrawMGNandDepositsFromBothPools()", () => {
    it("checks that all withdrawals are processed correctly", async () => {
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const mgn = await TokenFRT.new()
      
      const poolingTime = 1000
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      
      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      const coordinator = await Coordinator.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)

      const instance1 = await DxMgnPool.at(await coordinator.dxMgnPool1.call())
      const instance2 = await DxMgnPool.at(await coordinator.dxMgnPool2.call())

      await instance1.deposit(10)
      await instance2.deposit(10)

      await increaseTimeBy(poolingTime, web3)

      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await instance1.triggerMGNunlockAndClaimTokens()
      await instance2.triggerMGNunlockAndClaimTokens()
      await increaseTimeBy(24*60*60+12, web3)
      await instance1.withdrawUnlockedMagnoliaFromDx()
      await instance2.withdrawUnlockedMagnoliaFromDx()
      
      await coordinator.withdrawMGNandDepositsFromBothPools()
    })
  })
})