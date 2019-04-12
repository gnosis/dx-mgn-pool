const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const TokenFRT = artifacts.require("TokenFRT")
const TokenOWL = artifacts.require("TokenOWL")

const abi = require("ethereumjs-abi")

const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")

const truffleAssert = require("truffle-assertions")
const { increaseTimeBy } = require("./utilities")

contract("DxMgnPool", (accounts) => {
  describe("deposit()", () => {
    it("adds a particpation", async () => {
      const dx = await DutchExchange.new()
      
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
    
      await depositTokenMock.givenAnyReturnBool(true)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      await dxMock.givenAnyReturnUint(42)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)
      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, 100)
      
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
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      
      await depositTokenMock.givenAnyReturnBool(false)
      await dxMock.givenAnyReturnUint(42)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      
      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, 0)
      await truffleAssert.reverts(instance.deposit(10))
    })
    it("fails if pooling ended", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      await depositTokenMock.givenAnyReturnBool(false)
      await dxMock.givenAnyReturnUint(42)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      await increaseTimeBy(102, web3)

      await truffleAssert.reverts(instance.deposit(10), "Pooling is already over")
    })
    it("address can make deposit smaller than total deposit thus far", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await truffleAssert.reverts(instance.participateInAuction({ from: accounts[2] })) //ownable has no designated error messages
    })
    it("updates auctionCount and cummulative shares", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const postSellOrderResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, postSellOrderResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 1)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 20)
    })
    it("fails if pooling period is over", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 1

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)

      await increaseTimeBy(100, web3)

      await truffleAssert.reverts(instance.participateInAuction(), "Pooling period is over")
    })
    it("pooling period ends only after even amount of auctions", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(1)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      let tupleResponse = (abi.rawEncode(["uint", "uint"], [1, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(42)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const getAuctionIndex = dx.contract.methods.getAuctionIndex(accounts[0], accounts[0]).encodeABI()
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await dxMock.givenMethodReturnUint(getAuctionIndex, 2)
      await instance.participateInAuction()

      await instance.deposit(20)
      await dxMock.givenMethodReturnUint(getAuctionIndex, 3)
      await instance.participateInAuction()

      assert.equal(await instance.auctionCount.call(), 2)
      assert.equal(await instance.totalPoolSharesCummulative.call(), 20) // just 2*10 from first deposit
    })
  })

  describe("poolSharesByAddress()", () => {
    it("checks that it returns the right amounts", async () => {   
      const dx = await DutchExchange.new()
      
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
    
      await depositTokenMock.givenAnyReturnBool(true)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      await dxMock.givenAnyReturnUint(42)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)
      
      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, 100)
      
      await depositTokenMock.givenAnyReturnBool(true) 
      
      await instance.deposit(10)
      const [amount] = await instance.poolSharesByAddress.call(accounts[0])
      assert(amount, 10, "poolShares are not correct")
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
      const poolingTime = 100
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await increaseTimeBy(100, web3)
      await depositTokenMock.givenAnyReturnBool(true)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 0)
      await instance.triggerMGNunlockAndClaimTokens()
      
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
      const poolingTime = 100
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await dxMock.givenAnyReturnUint(20)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.deposit(10)
      await increaseTimeBy(100, web3)
      await depositTokenMock.givenAnyReturnBool(true)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 0)
      await instance.triggerMGNunlockAndClaimTokens()
      
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
      const poolingTime = 100
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)

      await increaseTimeBy(100, web3)
      await depositTokenMock.givenAnyReturnBool(true)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
     
      await depositTokenMock.givenMethodReturnUint(balanceOf, 0)
      await instance.triggerMGNunlockAndClaimTokens()
      
      await instance.withdrawDeposit()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 10).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)

      await truffleAssert.reverts(instance.withdrawDeposit(), "sender has already withdrawn funds")
    })
    it("cannot withdraw while pooling is running", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      await truffleAssert.reverts(instance.withdrawDeposit(), "Funds not yet withdrawn from dx")
    })
    it("fails if deposit retransfer fails", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)

      await increaseTimeBy(100, web3)
      await depositTokenMock.givenAnyReturnBool(false)
      await truffleAssert.reverts(instance.withdrawDeposit())
    })
  })
  describe("triggerMGNunlockAndClaimTokens()", () => {
    it("unlocksMGN, claims and withdraws depositToken", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()
      const token = await ERC20.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 1
      
      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await increaseTimeBy(poolingTime, web3)
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      await instance.triggerMGNunlockAndClaimTokens()
      await depositTokenMock.givenAnyReturnUint(0)

      const withdraw = dx.contract.methods.withdraw(depositTokenMock.address, 42).encodeABI()
      assert.equal(await dxMock.invocationCountForCalldata.call(withdraw), 1)
    })
    it("makes a deposit shortly before pooling ending and checks that it is accounted correctly", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 10
      
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenAnyReturnUint(10)
      await dxMock.givenAnyReturnUint(10)
      // return balance of 10
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [10, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      
      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      await increaseTimeBy(poolingTime, web3)
      await instance.triggerMGNunlockAndClaimTokens()

      assert.equal(await instance.totalDeposit.call(), 10+10)
    })
    it("fails if still pooling", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)

      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Pooling period is not yet over.")
    })
    it("does not throw if pool has zero balance in dutchX", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()
      const token = await ERC20.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime =  0
      
      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const balances = dx.contract.methods.balances(accounts[0], accounts[0]).encodeABI()
      await dxMock.givenMethodReturnUint(balances, 0)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      await instance.triggerMGNunlockAndClaimTokens()
    })
    it("checks that function can not be called twice", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()
      const token = await ERC20.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 0
      
      await dxMock.givenAnyReturnUint(42)
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [42, 0]))
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const balances = dx.contract.methods.balances(accounts[0], accounts[0]).encodeABI()
      await dxMock.givenMethodReturnUint(balances, 0)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      await instance.triggerMGNunlockAndClaimTokens()
      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Pooling period is not yet over.")
    })
    it("fails if last auction still running", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 1000
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)
      
      await dxMock.givenAnyReturnUint(2)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.participateInAuction()

      await dxMock.givenAnyReturnUint(3)
      await dxMock.givenMethodReturn(postSellOrder, abi.rawEncode(["uint", "uint"], [3, 0]))
      await instance.participateInAuction()

      await increaseTimeBy(1000, web3)

      await truffleAssert.reverts(instance.triggerMGNunlockAndClaimTokens(), "Last auction is still running")
    })
  })
  describe("withdrawUnlockedMagnoliaFromDx()", () => {
    it("fails if still pooling", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)

      await truffleAssert.reverts(instance.withdrawUnlockedMagnoliaFromDx(), "Unlocking not yet triggered")
    })
    it("checks that function can not be called twice", async () => {
      const dx = await DutchExchange.new()
      const mgn = await TokenFRT.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 1000
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)
      
      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.participateInAuction()

      await instance.participateInAuction()

      await increaseTimeBy(poolingTime, web3)
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

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
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()

      await increaseTimeBy(101, web3)

      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawUnlockedMagnoliaFromDx()

      assert.equal(await instance.totalMgn.call(), 100)

      await instance.withdrawDeposit()
      await instance.withdrawMagnolia()

      const mgnTransfer = mgn.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(mgnTransfer), 1)
    })
    it("fails if Magnolia was not unlocked", async () => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingTime = 100

      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)

      await truffleAssert.reverts(instance.withdrawMagnolia(), "MGN has not been unlocked, yet")
    })
    it("fails if deposit was not withdrawn", async () => {
      const mgn = await TokenFRT.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      await mgnTokenMock.givenAnyReturnUint(100)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const balanceOf = mgnToken.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(false)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
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
  describe("withdrawDepositandMagnolia()", () => {
    it("withdraws the same amounts when using withdrawDepositandMagnolia instead of native functions", async () => {
      const mgn = await TokenFRT.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const dx = await DutchExchange.new()
      const poolingTime = 100
      
      await depositTokenMock.givenAnyReturnBool(true)
      
      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      const claimSellerFunds = dx.contract.methods.claimSellerFunds(accounts[0], accounts[0], accounts[0], 0).encodeABI()
      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      const balanceOf = mgn.contract.methods.balanceOf(accounts[0]).encodeABI()
      await mgnTokenMock.givenAnyReturnBool(true)
      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, poolingTime)
      
      await instance.deposit(10)
      await instance.participateInAuction()
      await instance.participateInAuction()

      await increaseTimeBy(101, web3)

      await dxMock.givenMethodReturn(claimSellerFunds, tupleResponse)

      const unlockTokens = mgn.contract.methods.unlockTokens().encodeABI()
      await mgnTokenMock.givenMethodReturn(unlockTokens, tupleResponse)

      await instance.triggerMGNunlockAndClaimTokens()
      await instance.withdrawUnlockedMagnoliaFromDx()

      assert.equal(await instance.totalMgn.call(), 100)

      const depositWithdraw = await instance.withdrawDeposit.call()

      const withdrawOutputs = await instance.withdrawDepositandMagnolia.call()
      await instance.withdrawDepositandMagnolia()
      assert.equal(depositWithdraw.toString(), withdrawOutputs[0].toString(), "deposit\Withdraws are different")

      const mgnTransfer = mgn.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(mgnTransfer), 1)
    })
  })
  describe("getAllClaimableMgnAndDeposits() view function", () => {
    it("returns values correctly", async () => {
      const dx = await DutchExchange.new()
      
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
    
      await depositTokenMock.givenAnyReturnBool(true)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      await dxMock.givenAnyReturnUint(42)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, 100)
      
      const { "0": claimableMgn, "1": claimableDeposits } = await instance.getAllClaimableMgnAndDeposits.call(accounts[0])

      assert.equal(claimableMgn.length, 0, "ClaimableMGN return array must be empty aka 0 length")
      assert.equal(claimableDeposits.length, 0, "claimableDeposits return array must be empty aka 0 length")
    })
  })
  describe("updateAndGetCurrentState()", () => {
    it("returns values correctly", async () => {
      const dx = await DutchExchange.new()
      
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
    
      await depositTokenMock.givenAnyReturnBool(true)
      const frtToken = dx.contract.methods.frtToken().encodeABI()
      await dxMock.givenMethodReturnAddress(frtToken, mgnTokenMock.address)

      const owlTokenMock = await MockContract.new()
      const owlToken = dx.contract.methods.owlToken().encodeABI()
      await dxMock.givenMethodReturnAddress(owlToken, owlTokenMock.address)

      const owl = await TokenOWL.new();
      const owlTokenApproveFunctionality = owl.contract.methods.approve(dxMock.address, 100).encodeABI()
      await owlTokenMock.givenMethodReturnBool(owlTokenApproveFunctionality, true)

      await dxMock.givenAnyReturnUint(42)
      
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, dxMock.address, 100)
      
      const state = await instance.updateAndGetCurrentState.call()
      
      assert(state, state.eq(web3.utils.toBN(0)), "Current state === 0 aka Pooling")
    })
  })
})
