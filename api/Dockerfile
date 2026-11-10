FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependency specifications and Prisma schema
COPY package.json bun.lock ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies and generate Prisma Client
RUN bun install --frozen-lockfile
ENV DATABASE_URL="postgresql://postgres:password@localhost:5432/knowledge_ai"
RUN bunx prisma generate

# Copy application source code and build
COPY . .
RUN bun run build

# Production image
FROM oven/bun:1 AS runner

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
