# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies needed for building (e.g., node-gyp for better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
