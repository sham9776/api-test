FROM node:20-alpine

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code and static assets
COPY . .

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
EXPOSE 8080

CMD ["npm", "start"]
