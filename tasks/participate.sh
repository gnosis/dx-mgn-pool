#!/bin/sh

cd /usr/src/app/
./node_modules/.bin/truffle exec scripts/participateInAuction.js --network $NETWORK
