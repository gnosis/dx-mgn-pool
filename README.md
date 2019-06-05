## Disclaimer
Please note that due to the mechanism design of the DutchX MGN Pool, it is expected that when participating in the DutchX MGN Pool the remaining number of the deposited tokens, which may be reclaimed following the end of the trading period, will be significantly lower than the initially deposited number of tokens and may in fact be nil (0). It is therefore advised to only participate in the DutchX MGN Pool, if one wishes to accrue MGN and values such accrued MGN sufficiently high to justify the significant risk of losing all tokens initially deposited into the DutchX MGN Pool.


# DX-MGN-POOL

The following repo contains all the smart contracts for the pool. Its goal is to collect liquidity and use it to trade automatically and continuously on the DutchX (in form of sell orders) over a predefined amount of time (~1 month). It will thus generate MGN, which the liquidity providers can claim according to their share, once the pooling period has ended.

A rough state diagram of the contract looks like this:

![dx-mgn-pool state diagram](dx-mgn-pool%20state%20machine.png)

The deployment consists of two smart contracts, `DxMgnPool` and a `Coordinator`

### DxMgnPool

This contract allows participants to deposit a single predefined ERC20 token (e.g. GNO) into the contract's balance. 
The contract will continuously participate with its entire balance in DutchX auctions and thus generate MGN (assuming a trading pair whitelisted for MGN generation in the DutchX, such as GNO/WETH).
We deploy a separate instance of the same contract for each individual token: e.g. one contract to deposit GNO tokens, and one contract to deposit WETH tokens. 
The two contracts will continuously trade their deposit token against the deposit token of the other pool. 

#### Auction process
1. Initially, the pool participates in the auction *depositToken* -> *secondaryToken*. 
It does so by posting a sell order for the full balance of its deposit token. 
2. After the first auction finishes, the contract claims all of its proclaims (in *secondaryToken*) and reinvests it as a sell order in the reverse auction (*secondaryToken* -> *depositToken*). 
3. After the reverse auction finishes, it claims all of its proclaims in the original deposit token and starts over.

One such round will take two DutchX auctions to finish, thus roughly 12 hours.
The pooling period is defined to end after an even number of auctions. 
Thus, participants can eventually withdraw the same ERC20 token they deposited.

With two deployed instances and our example above, the first pool trades GNO for WETH (step 1) followed by WETH for GNO (step 2).
The second pool starts by trading WETH for GNO followed by GNO for WETH.

#### Deposits
Deposits can happen at any time during the pooling period. 
A participant can post multiple deposits at different times. 
The contract computes the value of the deposit compared to the total balance it currently holds and eventually uses this "share" - combined with the time of deposit - to calculate the share of MGN that each participation contributed (see below).
Note, that a deposit only starts contributing to the MGN generation in the next even auction index (since the contract can only invest it in the *depositToken -> secondaryToken* auction)

#### Deposit Withdraws
Participants can withdraw their deposit **only after the pooling period has ended**.
**Note that**, due to price fluctuations, it is possible that people withdraw a different amount than they deposited. 
E.g. if they initially provided 10% of the pool and the price of GNO increased in step 2 of the auction process (*WETH -> GNO*), the contract will buy back less GNO than it sold in the first step.
Thus it might hold a smaller amount of GNO in the end than initially deposited.
Participants are only entitled to withdraw their share, which would then be worth less than the initial deposit.

Note that, in order to avoid adjusting all shares after each deposit, we don't store the relative contribution of each participation as a percentage, but rather as an absolute number of *pool shares* (more gas efficient).
`calculatePoolShares()` contains the logic for computing the number of pool shares a deposit is credited with.

#### Magnolia Withdraws
On top of their deposit share, participants can also claim their share of MGN tokens at the end.
We calculate the share by keeping an integral of pool shares that participated in auctions over time.
For each participation we can then compute their share by computing `lengthOfParticipation * shareOfParticipation / integral`

E.g. assume there were 50 shares (1st deposit 50GNO) in the first round, and 75 shares (2nd deposit 25GNO) in the second round, the integral would be 125 shares.
The first deposit would be entitled to `2 * 50 / 125 = 80%` of the minted magnolia.
The second deposit would be entitled to `1 * 25 / 125 = 20%` of the minted magnolia.

#### "Automated" Particpation

We deploy a bot (found under scripts) that will run continuously and check if the pools can participate in the next aution.
If so, the bot executes the according transaction.

Once the pooling period is over, we call `triggerMGNunlockAndClaimTokens()` manually. 
This will claim all remaining proceeds from the DutchX back into the pools deposit token balance to allow participants to withdraw their deposits.
It will also unlock all minted MGN.

Due to the way MGN works, we have to wait 24 hours more, before claiming the unlocked MGN into the pool's balance (by invoking `withdrawUnlockedMagnoliaFromDx()`).
At that point participants can withdraw their share of MGN.

In principle any party can invoke those calls. 
There is no logic enforcing that only our bot can invoke these functions.

### Coordinator

The coordinator is a simple wrapper contract that makes sure the two "opposite" pools (e.g. *GNO -> WETH* and *WETH -> GNO*) move synchronously in one atomic transaction.
This is to avoid that one pool skips an auction while the other one participates.
Then, both pools would participate in the same side of the auction, thus creating a liquidity imbalance.

The coordinator instantiates the two opposite pools and thus becomes their *owner*.
Only the owner can invoke `participateInAuction()`.
The coordinator exposes a `participateInAuction()` function itself, which can be called by any party (e.g. our bot).
This function serially calls `participatesInAuction()` on both pools and will revert if either fails. 
This ensures that either both or neither pool participate in the next auction.

Note, that only `participateInAuction()` has to be invoked through the `Coordinator`.
All other interactions can happen directly on the `DxMgnPool` instances.

## Get setup
```bash
# Install dependencies
npm install

# In one tab: Run ganache
npm run rpc
```

## Migrations

Set migration configuration:
```
export MNEMONIC='<YOUR_SECRET_MNEMONIC_PHRASE>'
export GAS_PRICE_GWEI='<Your GWEI config>'
export TRADING_END_TIME= '<Date in iso format,eg '2019-05-03T16:00:00+02:00'>'
export INFURA_KEY='your infura project id'
```

Local:
```bash
npm run migrate
```

Rinkeby:
```bash
npm run restore
npm run networks -- --clean
npm run migrate -- --reset --network rinkeby
npm run networks-extract
```

Mainnet:
```bash
npm run restore
npm run networks -- --clean
npm run migrate -- --reset --network mainnet
npm run networks-extract
```

## Participation Bot

The bot allow to define several coordinator addresses. At least one coordinaor
is mandatory.

To define the coordinators, use secuencial env vars like these ones:
```
COORDINATOR_ADDRESS_1=<address1>
COORDINATOR_ADDRESS_2=<address2>
COORDINATOR_ADDRESS_3=<address3>
...
```

For Ganache (deterministic)

```
docker build --rm -t participate .
docker run -t -i -e NETWORK=development COORDINATOR_ADDRESS_1=<address1> -e RPC_URL=host.docker.internal participate
```

For Rinkeby

```
docker build --rm -t participate .
docker run -t -i -e NETWORK=rinkeby COORDINATOR_ADDRESS_1=<address1> -e MNEMONIC='<YOUR_SECRET_MNEMONIC_PHRASE>' participate
```

For Mainnet

```
docker build --rm -t participate .
docker run -t -i -e NETWORK=mainnet COORDINATOR_ADDRESS_1=<address1> -e MNEMONIC='<YOUR_SECRET_MNEMONIC_PHRASE>' participate
```

## Current high-level deployment process


Process
- Check that all depend smart contracts (e.g. dx) have already been deployed and npm packages are updated
- Checkout new git release branch
- Set migration config and run scripts as listed in migration process 
- Change npm version: `npm version major|patch|minor`
- Publish npm package: `npm publish --access public`
- Push pr and merge into master branch
- Travis will build the bot and publish it to dockerhub. The name is gnosispm/'prefix'-dx-mgn-pool
- For production release, deploy the bots with the commands of deployment section
- Bot can be started by:
```
STOP RINKEBY version:
kubectl patch deployment dev-dx-mgn-pool -p '{"spec":{"replicas":0}}' -n dutchx

START RINKEBY version:
kubectl patch deployment dev-dx-mgn-pool -p '{"spec":{"replicas":1}}' -n dutchx

STOP MAINNET version:
kubectl patch deployment staging-dx-mgn-pool -p '{"spec":{"replicas":0}}' -n dutchx

START MAINNET version:
kubectl patch deployment staging-dx-mgn-pool -p '{"spec":{"replicas":1}}' -n dutchx
```
- Logs of the bots can be seen here:
```
RINKEBY
https://logs.gnosisdev.com/_plugin/kibana/app/kibana#/discover?_g=(refreshInterval:('$$hashKey':'object:2363',display:'5%20seconds',pause:!f,section:1,value:5000),time:(from:now%2Fd,mode:quick,to:now%2Fd))&_a=(columns:!(log,kubernetes.labels.network),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,index:'logstash-*',key:kubernetes.labels.app,negate:!f,type:phrase,value:dx-mgn-pool),query:(match:(kubernetes.labels.app:(query:dx-mgn-pool,type:phrase)))),('$state':(store:appState),meta:(alias:!n,disabled:!f,index:'logstash-*',key:kubernetes.labels.network,negate:!f,type:phrase,value:rinkeby),query:(match:(kubernetes.labels.network:(query:rinkeby,type:phrase))))),index:'logstash-*',interval:auto,query:(match_all:()),sort:!('@timestamp',desc))

MAINNET
https://logs.gnosisdev.com/_plugin/kibana/app/kibana#/discover?_g=(refreshInterval:('$$hashKey':'object:2363',display:'5%20seconds',pause:!f,section:1,value:5000),time:(from:now%2Fd,mode:quick,to:now%2Fd))&_a=(columns:!(log,kubernetes.labels.network),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,index:'logstash-*',key:kubernetes.labels.app,negate:!f,type:phrase,value:dx-mgn-pool),query:(match:(kubernetes.labels.app:(query:dx-mgn-pool,type:phrase)))),('$state':(store:appState),meta:(alias:!n,disabled:!f,index:'logstash-*',key:kubernetes.labels.network,negate:!f,type:phrase,value:mainnet),query:(match:(kubernetes.labels.network:(query:mainnet,type:phrase))))),index:'logstash-*',interval:auto,query:(match_all:()),sort:!('@timestamp',desc)) (edited) 
```

## Security-Advice:

If the operator of the dutchX protocol is proposing malicious changes, everyone in the pool should still be able to withdraw their funds before the malicious changes will be implemented. Hence, the deployed pooling time should never be greater than the review time of a new proposal for a dutchX upgrade.


