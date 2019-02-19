const got = require("got")

class Gastimator {
  async estimateGas (url) {
    const gasPriceResponse = await got(url, { json: true })
    const gasPrices = gasPriceResponse.body
    return {
      lowest: parseInt(gasPrices.lowest),
      average: parseInt(gasPrices.standard),
      fast: parseInt(gasPrices.fast)
    }
  }
}

module.exports = { Gastimator }