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
RUN bun install --production --frozen-lockfile

# Runner stage
FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=hono:nodejs /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=builder --chown=hono:nodejs /app/src/db /app/src/db
COPY --from=builder --chown=hono:nodejs /app/scripts /app/scripts

RUN mkdir -p /app/data && chown hono:nodejs /app/data


USER hono
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["bun", "run", "/app/dist/index.js"]