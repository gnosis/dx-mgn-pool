const waitForNBlocks = async function(numBlocks, authority) {
  for (let i = 0; i < numBlocks; i++) {
    await web3.eth.sendTransaction({from: authority, "to": authority, value: 1})
  }
}
const jsonrpc = '2.0'
const id = 0
const send = (method, params = []) =>
  web3.currentProvider.send({ id, jsonrpc, method, params })
const timeTravel = async seconds => {
  await send('evm_increaseTime', [seconds])
  await send('evm_mine')
}
const timestamp = async (block = 'latest') => {
	const b = await web3.eth.getBlock(block)
	return b.timestamp
}



module.exports = {
  waitForNBlocks,
  timeTravel,
  timestamp,
}