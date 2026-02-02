# Base stage
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Deps stage
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache --virtual .gyp python3 make g++
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod --ignore-scripts

# Runner stage (lean, production only)
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

RUN mkdir -p /app/data && chown hono:nodejs /app/data

USER hono
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "/app/dist/index.js"]

# Migration stage (for running db:push)
FROM base AS migrator
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=builder /app/src/db /app/src/db

RUN mkdir -p /app/data

CMD ["sh", "-c", "npx drizzle-kit push --force"]