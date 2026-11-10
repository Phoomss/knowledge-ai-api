# Multi-stage build for NestJS API
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies and build
RUN bun install --frozen-lockfile
ENV DATABASE_URL="postgresql://postgres:password@localhost:5432/knowledge_ai"
RUN bunx prisma generate

COPY . .
RUN bun run build

# Prune to production-only dependencies
RUN rm -rf node_modules
RUN bun install --production --frozen-lockfile
RUN bunx prisma generate

# Stage 2: Ultra-lightweight runtime with oven/bun:1-slim
FROM oven/bun:1-slim AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run start:prod"]
