const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const TokenFRT = artifacts.require("TokenFRT")

const abi = require("ethereumjs-abi")

const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")

const truffleAssert = require("truffle-assertions")
const { increaseTimeBy } = require("./utilities")

contract("DxMgnPool", (accounts) => {
  describe("deposit()", () => {
    it("adds a particpation", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingTime)

      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)

      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 1)
      const participation = await instance.participationAtIndex.call(accounts[0], 0)
      assert.equal(participation[1], 10)

      assert.equal(await instance.totalDeposit.call(), 10)
      assert.equal(await instance.totalPoolShares.call(), 10)
    })
    it("first participation index is always even", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingTime)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.deposit(100)

      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 2)

      let participationStruct = await instance.participationsByAddress(accounts[0], 0)
      assert.equal(participationStruct.startAuctionCount, 0)
      participationStruct = await instance.participationsByAddress(accounts[0], 1)
      assert.equal(participationStruct.startAuctionCount, 2)

    })
    it("fails if transfer fails", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime =  100

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingTime)

      await depositTokenMock.givenAnyReturnBool(false)
      await dxMock.givenAnyReturnUint(42)

      await truffleAssert.reverts(instance.deposit(10))
    })
    it("fails if pooling ended", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime= 100

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingTime)

      await increaseTime(102, web3)

      await depositTokenMock.givenAnyReturnBool(false)
      await dxMock.givenAnyReturnUint(42)

      await truffleAssert.reverts(instance.deposit(10), "Pooling is already over")
    })
    it("address can make deposit smaller than total deposit thus far", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock =  100

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      await instance.deposit(10)
      await instance.deposit(5)

      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 2)
      const participation = await instance.participationAtIndex.call(accounts[0], 1)
      assert.equal(participation[1], 5)

      assert.equal(await instance.totalDeposit.call(), 15)
      assert.equal(await instance.totalPoolShares.call(), 15)
    })
  })

  describe("participateInAuction()", () => {
    it("only owner can trigger it", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      await instance.deposit(10)
      await truffleAssert.reverts(instance.participateInAuction({ from: accounts[2] })) //ownable has no designated error messages
    })
    it("updates auctionCount and cummulative shares", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)

      await instance.deposit(10)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 1)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 10)
    })
    it("fails if pooling period is over", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 1
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await increaseTimeBy(100, web3)

      await truffleAssert.reverts(instance.participateInAuction(), "Pooling period is over")
    })
    it("pooling period ends only after even amount of autcions", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(1)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      let tupleResponse = (abi.rawEncode(["uint", "uint"], [1, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      await instance.deposit(10)
      await instance.participateInAuction()
      await increaseTimeBy(100, web3)

      await dxMock.givenAnyReturnUint(2)
      tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)

      await instance.participateInAuction()

      await dxMock.givenAnyReturnUint(3)
      await truffleAssert.reverts(instance.participateInAuction(), "Pooling period is over")
    })
    it("cannot participate twice with same auction id", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      await instance.deposit(10)
      await instance.participateInAuction()
      await truffleAssert.reverts(instance.participateInAuction(), "Has to wait for new auction to start")
    })
    it("can participate in consecutive auction", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const getAuctionIndex = dx.contract.methods.getAuctionIndex(accounts[0], accounts[0]).encodeABI()

      await instance.deposit(10)
      await dxMock.givenMethodReturnUint(getAuctionIndex, 2)
      await instance.participateInAuction()

      await instance.deposit(20)
      await dxMock.givenMethodReturnUint(getAuctionIndex, 3)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 2)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 40) // 2 * 10 from first deposit + 1 * 20 from second
    })
  })

  describe("withdrawDeposit()", () => {
    it("returns the original deposited amount", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()


      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)
      await increaseTimeBy(100, web3)
      await instance.withdrawDeposit()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 10).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)
    })
    it("returns all deposits of the sender in the same withdraw", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await dxMock.givenAnyReturnUint(20)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)

      await instance.deposit(10)
      await instance.deposit(10)
      await increaseTimeBy(100, web3)
      await instance.withdrawDeposit()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 20).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)
    })
    it("cannot withdraw already withdrawn amount", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()


      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)

      await increaseTimeBy(100, web3)
      await depositTokenMock.givenAnyReturnBool(true)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawDeposit()
      await instance.withdrawDeposit()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 10).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)

      const emptyTransfer = token.contract.methods.transfer(accounts[0], 0).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(emptyTransfer), 1)
    })
    it("cannot withdraw while pooling is running", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await truffleAssert.reverts(instance.withdrawDeposit(), "Funds not yet withdrawn from dx")
    })
    it("fails if deposit retransfer fails", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()


      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)

      await increaseTimeBy(100, web3)
      await instance.triggerMGNunlockAndClaimTokens()
      await depositTokenMock.givenAnyReturnBool(false)
      await truffleAssert.reverts(instance.withdrawDeposit())
    })
  })
  describe("triggerMGNunlockAndClaimTokens()", () => {
    it("unlocksMGN, claims and withdraws depositToken", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 1
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await increaseTimeBy(100, web3)
      await instance.triggerMGNunlockAndClaimTokens()

      const withdraw = dx.contract.methods.withdraw(depositTokenMock.address, 42).encodeABI()
      assert.equal(await dxMock.invocationCountForCalldata.call(withdraw), 1)
    })
    it("fails if still pooling", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Pooling period is not yet over.")
    })
    it("can deal with the case, totalDeposit == 0 (e.g. all funds are lost in dutchX)", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) -1
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const balances = dx.contract.methods.balances(accounts[0], accounts[0]).encodeABI()
      await dxMock.givenMethodReturnUint(balances, 0)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      instance.triggerMGNunlockAndClaimTokens()
    })
    it("checks idempotenz of funciton", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) -1
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const balances = dx.contract.methods.balances(accounts[0], accounts[0]).encodeABI()
      await dxMock.givenMethodReturnUint(balances, 0)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      instance.triggerMGNunlockAndClaimTokens()
      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Pooling period is not yet over.")
    })
    it("fails if last auction still running", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await dxMock.givenAnyReturnUint(2)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      await instance.deposit(10)
      await instance.participateInAuction()

      await dxMock.givenAnyReturnUint(3)
      await dxMock.givenMethodReturn(postSellOrder, abi.rawEncode(["uint", "uint"], [3, 0]))
      await instance.participateInAuction()
      
      await increaseTimeBy(100, web3)

      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Last auction is still running")
    })
  })
  describe("withdrawUnlockedMagnoliaFromDx()", () => {
    it("fails if still pooling", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await truffleAssert.reverts(instance.withdrawUnlockedMagnoliaFromDx(), "Unlocking not yet triggered")
    })
    it("Can not be called twice (idempotenz)", async () => {
      const mgn = await TokenFRT.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()

      await waitForNBlocks(100, accounts[0])
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawUnlockedMagnoliaFromDx()

      await truffleAssert.reverts(instance.withdrawUnlockedMagnoliaFromDx(), "Unlocking not yet triggered")
    })
  })
  describe("withdrawMagnolia()", () => {
    it("withdraws the right amount of MGN", async () => {
      const mgn = await TokenFRT.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()

      await increaseTimeBy(100, web3)


      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.withdrawUnlockedMagnoliaFromDx()

      assert.equal(await instance.totalMgn.call(), 100)

      await instance.withdrawDeposit()
      await instance.withdrawMagnolia()

      const mgnTransfer = mgn.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(mgnTransfer), 1)
    })
    it("fails if Magnolia was not unlocked", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await truffleAssert.reverts(instance.withdrawMagnolia(), "MGN has not been unlocked, yet")
    })
    it("fails if deposit was not withdrawn", async () => {
      const mgn = await TokenFRT.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      await mgnTokenMock.givenAnyReturnUint(100)

      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()
      await increaseTimeBy(100, web3)
      await dxMock.givenAnyReturnUint(42)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawUnlockedMagnoliaFromDx()

      assert.equal(await instance.totalMgn.call(), 100)

      await truffleAssert.reverts(instance.withdrawMagnolia(), "Withdraw deposits first")
    })
    it("fails if MGN transfer fails", async () => {
      const mgnToken = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingEndBlock = 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)

      await depositTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const balanceOf = mgnToken.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(false)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()

      await increaseTimeBy(100, web3)

      const unlockTokens = mgnToken.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawUnlockedMagnoliaFromDx()
      await instance.withdrawDeposit()

      await truffleAssert.reverts(instance.withdrawMagnolia())
    })
  })
})
