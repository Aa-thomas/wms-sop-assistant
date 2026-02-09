# Stage 1: Build React client
FROM node:20-alpine AS build

WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install client dependencies and build
COPY client/ client/
RUN cd client && npm install && npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code
COPY server/ server/

# Copy init script (for reference / manual runs)
COPY scripts/init_db.sql scripts/init_db.sql

# Copy built client from stage 1
COPY --from=build /app/client/dist client/dist

EXPOSE 3000

CMD ["node", "server/index.js"]
