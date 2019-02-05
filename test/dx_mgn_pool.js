const DxMgnPool = artifacts.require("DxMgnPool")
const DutchExchange = artifacts.require("DutchExchange")
const abi = require("ethereumjs-abi")

const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")

const truffleAssert = require("truffle-assertions")
const { waitForNBlocks } = require("./utilities")

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

      assert.equal(await instance.totalDeposit.call(), 30)
      assert.equal(await instance.totalPoolShares.call(), 30)
    })
  })

  describe("participateInAuction()", () => {
    it("updates auctionCount and cummulative shares", async() => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
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
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
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
    it("can participate in consecutive auction", async() => {
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
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

  describe("withdraw()", () => {
    it("returns the original deposited amount and MGN share", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)
      await instance.participateInAuction()
      await waitForNBlocks(100, accounts[0])
      await instance.withdraw()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 10).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)

      const magnoliaTransfer = token.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(magnoliaTransfer), 1)
    })
    it("returns all deposits of the sender in the same withdraw", async() => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(20)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const tupleResponse = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, tupleResponse)
      
      await instance.deposit(10)
      await instance.deposit(10)
      await instance.participateInAuction()
      await waitForNBlocks(100, accounts[0])
      await instance.withdraw()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 20).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)

      const magnoliaTransfer = token.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(magnoliaTransfer), 1)
    })
    it("cannot withdraw already withdrawn amount", async() => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)
      await instance.participateInAuction()
      
      await waitForNBlocks(100, accounts[0])
      await depositTokenMock.givenAnyReturnBool(true)

      await instance.withdraw()
      await instance.withdraw()

      const depositTransfer = token.contract.methods.transfer(accounts[0], 10).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(depositTransfer), 1)

      const magnoliaTransfer = token.contract.methods.transfer(accounts[0], 100).encodeABI()
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(magnoliaTransfer), 1)

      const emptyTransfer = token.contract.methods.transfer(accounts[0], 0).encodeABI()
      assert.equal(await depositTokenMock.invocationCountForCalldata.call(emptyTransfer), 1)
      assert.equal(await mgnTokenMock.invocationCountForCalldata.call(emptyTransfer), 1)
    })
    it("cannot withdraw while pooling is running", async() => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
  
      await truffleAssert.reverts(instance.withdraw(), "Pooling period is not over, yet")
    })
    it("fails if deposit retransfer fails", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)
      await instance.participateInAuction()
      
      await waitForNBlocks(100, accounts[0])

      await depositTokenMock.givenAnyReturnBool(false)
      await truffleAssert.reverts(instance.withdraw(), "Failed to transfer deposit")
    })
    it("fails if MGN transfer fails", async () => {
      const token = await ERC20.new()
      const dx = await DutchExchange.new()

      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      const balanceOf = token.contract.methods.balanceOf(accounts[0]).encodeABI()
      await depositTokenMock.givenAnyReturnBool(true)
      await depositTokenMock.givenMethodReturnUint(balanceOf, 2)

      await mgnTokenMock.givenMethodReturnUint(balanceOf, 100)
      await mgnTokenMock.givenAnyReturnBool(false)

      await dxMock.givenAnyReturnUint(10)
      const postSellOrder = dx.contract.methods.postSellOrder(accounts[0], accounts[0], 0, 0).encodeABI()
      const reponseType = (abi.rawEncode(["uint", "uint"], [2, 0]))
      await dxMock.givenMethodReturn(postSellOrder, reponseType)

      await instance.deposit(10)
      await instance.participateInAuction()
      
      await waitForNBlocks(100, accounts[0])

      await truffleAssert.reverts(instance.withdraw(), "Failed to transfer MGN")
    })
  })
})