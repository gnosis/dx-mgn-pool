#!/bin/sh
MAIL_TO=ben@gnosis.pm

cd /usr/src/app/
./node_modules/.bin/truffle exec scripts/participateInAuction.js --network $NETWORK > bot_log.txt

EXIT_STATUS=$?
cat bot_log.txt

if [ $EXIT_STATUS -ne 0 ];then
    echo "Sending Error message to ${MAIL_TO}"
    cat bot_log.txt | mail -s "MGN Pool Error" ${MAIL_TO}
fi;
