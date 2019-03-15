FROM node:8.11-alpine

# Create app directory
WORKDIR /usr/src/app/


# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json truffle-config.js ./
COPY contracts contracts

# Compile necesary contracts for app and cleanup unnecesary files
RUN apk add --update --no-cache --virtual build-dependencies git python make bash g++ ca-certificates && \
    apk add --no-cache git

COPY . .
RUN rm -r node_modules
COPY tasks/cron-task /etc/crontabs/root

RUN chmod +x tasks/participate.sh

RUN npm install

RUN apk del build-dependencies

RUN ./node_modules/.bin/truffle compile

RUN npm run networks-inject

# Apply cron job
RUN crontab /etc/crontabs/root

# Run the command on container startup
CMD [ "sh", "-c", "echo 'Starting container service' && /usr/sbin/crond -f" ]
