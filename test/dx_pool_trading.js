const DxMgnPool = artifacts.require("DxMgnPool")
const ERC20 = artifacts.require("ERC20")
const MockContract = artifacts.require("MockContract")
const DX = artifacts.require("DutchExchange")
const DXProxy = artifacts.require("DutchExchangeProxy")

const truffleAssert = require("truffle-assertions")
const { waitForNBlocks } = require("./utilities")
const BN = web3.utils.BN;


contract("Trading", (accounts) => {
	it("adds a particpation and deposits them into first auction", async () => {
      const depositTokenMock = await MockContract.new()
      const secondaryTokenMock = await MockContract.new()
      const mgnTokenMock = await MockContract.new()
      const dxProxy = await DXProxy.deployed()
      const dx = await DX.at(dxProxy.address)
      const erc20 = await ERC20.new()
      const instance = await DxMgnPool.new(depositTokenMock.address, secondaryTokenMock.address, mgnTokenMock.address, dx.address, 100000)

      await depositTokenMock.givenAnyReturnBool(true)
      await secondaryTokenMock.givenAnyReturnBool(true)

      await instance.deposit(10)
      assert.equal(await instance.numberOfParticipations.call(accounts[0]), 1)

      //frist tokenPair needs to be funded first...
      const largeNumber = new BN('100000000000000000000000000000')
      await dx.deposit(depositTokenMock.address, largeNumber.toString())
      await dx.deposit(secondaryTokenMock.address, largeNumber.toString())
      await dx.addTokenPair(
        depositTokenMock.address,
        secondaryTokenMock.address,
        largeNumber.toString(),
        largeNumber.toString(),
        2,
        1
      )

      await depositTokenMock.givenAnyReturnUint(10)
      const balanceOf = erc20.contract.methods.balanceOf(instance.address).encodeABI()
      await depositTokenMock.givenMethodReturnUint(balanceOf, 10)
      await instance.participateInAuction()

	  assert.equal(await dx.sellerBalance.call(DxMgnPool.address, 0), 10)
	});
});
