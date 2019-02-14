echo 'Starting container service'

# Postfix minimal configuration
postconf "smtputf8_enable = no"
mkfifo /var/spool/postfix/public/pickup
postfix start

/usr/sbin/crond -f