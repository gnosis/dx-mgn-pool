FROM node:8.11-alpine

# Create app directory
WORKDIR /usr/src/app/


# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json truffle-config.js ./
COPY contracts contracts

# Compile necesary contracts for app and cleanup unnecesary files
RUN apk add --update --no-cache --virtual build-dependencies git python make g++ ca-certificates && \
    apk del build-dependencies && \
    apk add --no-cache git

COPY . .
COPY tasks/cron-task /etc/crontabs/root

RUN npm install

RUN ./node_modules/.bin/truffle compile

# Apply cron job
RUN crontab /etc/crontabs/root

# Run the command on container startup
CMD [ "/usr/sbin/crond", "-f" ]
