const waitForNBlocks = async function (numBlocks, authority, web3=web3) {
  for (let i = 0; i < numBlocks; i++) {
    await web3.eth.sendTransaction({ from: authority, "to": authority, value: 1 })
  }
}

const timestamp = async (web3, block = "latest") => {
  const b = await web3.eth.getBlock(block)
  return b.timestamp
}

const increaseTimeBy = async (seconds, web3=web3) => {
  if (seconds < 0) {
    throw new Error("Can\"t decrease time in testrpc")
  }

  if (seconds === 0) return

  await new Promise((accept, rej) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [seconds],
      id: new Date().getSeconds(),
    }, (err, resp) => {
      if (!err) return accept(resp)

      return rej(err)
    })
  })

  await new Promise((accept, rej) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      params: [],
      id: new Date().getSeconds(),
    }, (err, resp) => {
      if (!err) return accept(resp)

      return rej(err)
    })
  })
}

const waitUntilPriceIsXPercentOfPreviousPrice = async (dx , ST, BT, p, web3=web3) => {
  const getAuctionStart = await dx.getAuctionStart.call(ST.address, BT.address)
  const startingTimeOfAuction = getAuctionStart.toNumber()
  const timeToWaitFor = Math.ceil((86400 - p * 43200) / (1 + p)) + startingTimeOfAuction
  // wait until the price is good
  if (timeToWaitFor - await timestamp(web3) < 0) {
    return
  }
  await increaseTimeBy(timeToWaitFor - await timestamp(web3), web3)
}

module.exports = {
  waitUntilPriceIsXPercentOfPreviousPrice,
  increaseTimeBy,
  waitForNBlocks,
}