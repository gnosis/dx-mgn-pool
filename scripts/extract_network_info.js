const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const dir = path.join('build', 'contracts')
const dirFiles = fs.readdirSync(dir)
const networkFile = process.env.NETWORKS_FILE || 'networks.json'

Promise.all(dirFiles.filter(fname => fname.endsWith('.json')).map(fname => new Promise((resolve, reject) => {
  fs.readFile(path.join(dir, fname), (err, data) => {
    if (err) throw err
    resolve([fname.slice(0, -5), JSON.parse(data)['networks']])
  })
}))).then(nameNetworkPairs => {
  fs.writeFileSync(networkFile, JSON.stringify(_.fromPairs(nameNetworkPairs.filter(([_name, nets]) => !_.isEmpty(nets))), null, 2))
})
