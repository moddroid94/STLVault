# --- STAGE 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files first to cache npm install layer
COPY package*.json ./
RUN npm install

# Copy source code and run build
COPY . .
RUN npm run build


# --- STAGE 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dos2unix
RUN npm install -g serve

# Copy only the built assets from the builder stage
# Adjust '/dist' if your build output directory is different
COPY --from=builder /app/dist ./dist

# Copy runtime scripts and environment setup
COPY env.sh /docker-entrypoint.d/env.sh
RUN dos2unix /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

EXPOSE 5173

ENTRYPOINT ["/docker-entrypoint.d/env.sh"]
