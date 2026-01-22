# Dockerfile for ScheduleOS (ShiftSync)
# This Dockerfile is configured for secure deployment on Railway or other container platforms.

# --- Base Image ---
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# --- Builder Stage ---
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- Secrets: DO NOT bake secret values into the Docker image ---
# IMPORTANT: This Dockerfile does NOT require build-time secrets.
# All secrets (NEXTAUTH_SECRET, RESEND_API_KEY, DATABASE_URL, etc.) should be 
# provided at RUNTIME via environment variables in your deployment platform.
#
# For Railway: Set these in Project → Variables
# For Docker: Use `docker run --env NEXTAUTH_SECRET=xxx --env RESEND_API_KEY=xxx`
# For Kubernetes: Use Secrets or ConfigMaps
#
# Do NOT set ARG or ENV with secret defaults here, as this would bake them into 
# image layers, which is a security risk.

# --- Ensure NIXPACKS_PATH has a fallback value to avoid undefined-var errors ---
# This variable is used by Nixpacks on Railway. If not provided, use a safe default.
ARG NIXPACKS_PATH
ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production Runner Stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Note: The CMD runs migrations before starting. In production with multiple replicas,
# consider using Railway's health checks and restart policies, or run migrations separately
# via a one-off job: `railway run npx prisma migrate deploy`
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
