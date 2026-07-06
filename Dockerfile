# STAGE 1: Build the frontend React client SPA
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.js index.html ./
COPY src/ ./src/
RUN npm run build:client

# STAGE 2: Build the Express production server
FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production

# Install SQLite compile tool fallbacks just in case
RUN apk add --no-cache python3 make g++

COPY tsconfig.server.json ./
COPY server/ ./server/
COPY --from=client-builder /app/dist ./dist

# Compile the TypeScript server code
RUN npx tsc -p tsconfig.server.json

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist-server/server.js"]
