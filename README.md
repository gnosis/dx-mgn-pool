### DX-MGN-POOL

The following repo contains all the smart contracts for the pool. Its goal is to collect liquidity that will be automatically on continuously trade on the dutch exchange (in form of sell orders). It will thus generate MGN, which can the liquidity provider can claim according to their share, once the pooling period has ended.

A rough state diagram of the contract looks like this:

![dx-mgn-pool state diagram](dx-mgn-pool%20state%20machine.png)

## Get setup
```bash
# Install dependencies
npm install

# In one tab: Run ganache
npm run rpc
```

## Migrations
Local:
```bash
npm run migrate
```

Rinkeby:
```bash
npm run migrate -- --network rinkeby
```

Mainnet:
```bash
npm run migrate -- --network mainnet
```

## Participation Bot

For Ganache (deterministic)

```
docker build --rm -t participate .
docker run -t -i -e NETWORK=development -e RPC_URL=host.docker.internal participate
```

For Rinkeby

```
docker build --rm -t participate .
docker run -t -i -e NETWORK=rinkeby participate
```
