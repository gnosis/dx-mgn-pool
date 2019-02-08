### DX-MGN-POOL

The following repo contains all the smart contracts for the pool.

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

To run this process in the background and check on the status of the job use, 

```
docker run -e NETWORK=rinkeby participate &
docker ps
docker exec -it <CONTAINER ID> sh
tail -f /var/log/participation.out
```