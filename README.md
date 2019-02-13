# DX-MGN-POOL

The following repo contains all the smart contracts for the pool. Its goal is to collect liquidity that will automatically and continuously trade on the dutch exchange (in form of sell orders) over a predefined amount of time (~1 month). It will thus generate MGN, which the liquidity providers can claim according to their share, once the pooling period has ended.

A rough state diagram of the contract looks like this:

![dx-mgn-pool state diagram](dx-mgn-pool%20state%20machine.png)

The deployment consists of two smart contracts, `DxMgnPool` and a `Coordinator`

### DxMgnPool

This contract allows participants to deposit a single predefined ERC20 token (e.g. GNO) into the contract's balance. 
The contract will continuously participate with its entire balance in dutchX auctions and thus generate magnolia.
We deploy two instances of the same contract: one allowing to deposit a token (e.g. GNO) and another one allowing to deposit another token (e.g. WETH). 
The two contracts will continuously trade their deposit token against the deposit token of the other pool. 

#### Auction process
1. Initially, the pool participates in the auction *depositToken* -> *secondaryToken*. 
It does so by posting a sell order for the full balance of its deposit token. 
2. After the first auction finishes, the contract claims all of its proclaims (in *secondaryToken*) and reinvests it as a sell order in the reverse auction (*secondaryToken* -> *depositToken*). 
3. After the reverse auction finishes, it claims all of its proclaims in the original deposit token and starts over.

One such round will take two dutchX auctions to finish, thus roughly 12 hours.
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
Note, that due to price fluctuations it is possible that people withdraw a different amount than they deposited. 
E.g. if they initially provided 10% of the pool and the price of GNO fell over the time of pooling, the contract will hold less GNO at the end.
Particpants are only entitled to withdraw their share, which would then be worth less than the initial deposit.

Note, that in order to avoid adjusting all shares after each deposit, we don't store the relative contribution of each participation in %, but instead store an absolute number of *pool shares* (more gas efficient).
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
This will claim all remaining proceeds from the dutchX back into the pools deposit token balance to allow participants to withdraw their deposits.
It will also unlock all minted MGN.

Due to the way MGN works, we have to wait 24 hours more, before claiming the unlocked MGN into the pool's balance (by invoking `withdrawUnlockedMagnoliaFromDx()`).
At that point participants can withdraw their share of MGN.

In principle any party can invoke those calls. 
There are no permission checks that are relying on our bot invoking these functions.

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
