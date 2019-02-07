const waitForNBlocks = async function (numBlocks, authority) {
  for (let i = 0; i < numBlocks; i++) {
    await web3.eth.sendTransaction({ from: authority, "to": authority, value: 1 })
  }
}

const timestamp = async (block = 'latest') => {
  const b = await web3.eth.getBlock(block)
  return b.timestamp
}

const mineCurrentBlock = async () => await web3.currentProvider.send({
  jsonrpc: '2.0',
  method: 'evm_mine',
  params: [],
  id: 0,
})

const increaseTimeBy = async (seconds) => {
  if (seconds < 0) {
    throw new Error('Can\'t decrease time in testrpc')
  }

  if (seconds === 0) return

  await new Promise((accept, rej) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds],
      id: new Date().getSeconds(),
    }, (err, resp) => {
      if (!err) return accept(resp)

      return rej(err)
    })
  })

  await new Promise((accept, rej) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: new Date().getSeconds(),
    }, (err, resp) => {
      if (!err) return accept(resp)

      return rej(err)
    })
  })
}


module.exports = {
  mineCurrentBlock,
  increaseTimeBy,
  waitForNBlocks,
  timestamp,
}