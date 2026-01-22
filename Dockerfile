# Multi-stage Dockerfile for Next.js application
# Based on Next.js standalone output with Prisma support

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Do NOT bake secret values into the Docker image. Set these at runtime in your deployment host (Railway, Vercel) under Project > Variables.
ARG NEXTAUTH_SECRET
ARG RESEND_API_KEY
# Do not set ENV defaults for secrets here to avoid leaking them into image layers. If you must use build-time secrets use Docker BuildKit: `--secret`.

# Define NIXPACKS_PATH with fallback to avoid undefined variable errors
# NIXPACKS_PATH is used by Railway's Nixpacks builder. If undefined, it can cause build failures when referenced in build scripts.
# Setting a safe fallback ensures compatibility across different deployment environments.
ARG NIXPACKS_PATH
ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}

# Build arguments (needed for Prisma generation and Next.js build)
# DATABASE_URL may contain credentials - prefer using BuildKit --secret or set at runtime
ARG DATABASE_URL
ARG DIRECT_URL
ARG NEXTAUTH_URL

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for migrations at runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime secrets should be set via Railway Project > Variables:
# - NEXTAUTH_SECRET
# - RESEND_API_KEY
# - DATABASE_URL
# - NEXTAUTH_URL

CMD ["node", "server.js"]
