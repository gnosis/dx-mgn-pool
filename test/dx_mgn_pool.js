const DxMgnPool = artifacts.require("DxMgnPool")
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

      await truffleAssert.reverts(instance.participateInAuction(), "Has to wait for new auction to start")
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

  describe("withdraw()", () => {
    it("returns the original deposited amount and MGN share", async () => {
      const token = await ERC20.new()
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      const mgnBalance = token.contract.methods.balanceOf(instance.address).encodeABI()
      await mgnTokenMock.givenMethodReturnUint(mgnBalance, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

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
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      const mgnBalance = token.contract.methods.balanceOf(instance.address).encodeABI()
      await mgnTokenMock.givenMethodReturnUint(mgnBalance, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

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
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)

      const mgnBalance = token.contract.methods.balanceOf(instance.address).encodeABI()
      await mgnTokenMock.givenMethodReturnUint(mgnBalance, 100)
      await mgnTokenMock.givenAnyReturnBool(true)

      await instance.deposit(10)
      await instance.participateInAuction()
      
      await waitForNBlocks(100, accounts[0])
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
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxMock = await MockContract.new()
      const poolingEndBlock = (await web3.eth.getBlockNumber()) + 100
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dxMock.address, poolingEndBlock)
      
      await depositTokenMock.givenAnyReturnBool(true)
      await dxMock.givenAnyReturnUint(42)
      
      const mgnBalance = token.contract.methods.balanceOf(instance.address).encodeABI()
      await mgnTokenMock.givenMethodReturnUint(mgnBalance, 100)

      await instance.deposit(10)
      await instance.participateInAuction()
      
      await waitForNBlocks(100, accounts[0])

      await depositTokenMock.givenAnyReturnBool(false)
      await truffleAssert.reverts(instance.withdraw(), "Failed to transfer deposit")
    })
  })
})