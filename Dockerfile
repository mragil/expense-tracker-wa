# Base stage with bun
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Deps stage
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Runner stage
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Copy production dependencies and built files
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json

# Copy drizzle files for migrations
COPY --from=builder /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=builder /app/src/db /app/src/db

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DB_PATH=/app/data/sqlite.db


CMD ["sh", "-c", "mkdir -p /app/data && bun run db:push && bun run /app/dist/index.js"]