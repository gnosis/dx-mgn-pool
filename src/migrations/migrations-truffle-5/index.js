const deployDutchXAndDependencies = require("./2_deploy_DutchX_and_Dependencies")
const deployWETH = require("./3_deploy_WETH")
const deployPool = require("./4_deploy_Pool")

module.exports = async params => {
  await deployDutchXAndDependencies(params)
  await deployWETH(params)
  await deployPool(params)
}
