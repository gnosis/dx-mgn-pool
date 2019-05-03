FROM node:8.16 as builder

# Create build directory
WORKDIR /tmp/build

# Install first dependencies, so docker can cache this layer
COPY package*.json truffle-config.js ./
COPY contracts contracts

# Then the rest of files
COPY . .

RUN npm install

RUN ./node_modules/.bin/truffle compile

# Use release image (smaller)
FROM node:8.16-alpine

# Create app directory
WORKDIR /usr/src/app

COPY --from=builder /tmp/build .

RUN npm run networks-inject


# Apply cron job
COPY tasks/cron-task /etc/crontabs/root
RUN crontab /etc/crontabs/root

# Run the command on container startup
CMD [ "sh", "-c", "echo 'Starting container service' && /usr/sbin/crond -f" ]
