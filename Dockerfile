# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies needed for building (e.g., node-gyp for better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm pkg delete scripts.prepare
RUN pnpm install

COPY . .
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3 and healthchecks
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./
RUN pnpm pkg delete scripts.prepare
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
