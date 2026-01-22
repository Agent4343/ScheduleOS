# Docker Security Best Practices for ScheduleOS

## Background

This repository currently uses Nixpacks for deployment on Railway and does not have a Dockerfile. This document provides guidance for maintaining secure builds if a Dockerfile is added in the future.

## Critical Security Guidelines

### 1. Never Bake Secrets into Docker Images

**❌ WRONG - Do Not Do This:**
```dockerfile
# DO NOT include secret defaults in your Dockerfile
ARG NEXTAUTH_SECRET=supersecret
ARG RESEND_API_KEY=sk_...
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV RESEND_API_KEY=${RESEND_API_KEY}
```

**✅ CORRECT - Declare ARGs Without Defaults:**
```dockerfile
# Do NOT bake secret values into the Docker image. 
# Set these at runtime in your deployment host (Railway, Vercel) under Project > Variables.
ARG NEXTAUTH_SECRET
ARG RESEND_API_KEY

# Do not set ENV defaults for secrets here to avoid leaking them into image layers.
# If you must use build-time secrets, use Docker BuildKit: 
# docker build --secret id=nextauth_secret,src=secrets.txt .
```

### 2. Handle NIXPACKS_PATH Safely

If using Nixpacks or similar build systems, provide safe fallbacks for environment variables:

```dockerfile
# Provide safe fallback for NIXPACKS_PATH to prevent undefined variable errors
ARG NIXPACKS_PATH
ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}
```

## Deployment Instructions for Railway

### Setting Secrets (Recommended Approach)

1. **Navigate to Railway Project > Variables**
2. **Add environment variables:**
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `RESEND_API_KEY` - Your Resend API key from https://resend.com
   - `DATABASE_URL` - Automatically set by Railway PostgreSQL
   - `DIRECT_URL` - Set to `${{Postgres.DATABASE_URL}}`

3. **Never commit these secrets to version control**

### If You Accidentally Committed Secrets

If you accidentally committed secrets to your repository:

1. **Rotate all exposed secrets immediately**
   - Generate new NEXTAUTH_SECRET: `openssl rand -base64 32`
   - Regenerate RESEND_API_KEY from Resend dashboard
   - Update Railway environment variables

2. **Remove secrets from Git history** (if needed):
   ```bash
   # Use git-filter-repo or BFG Repo Cleaner
   # See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
   ```

3. **Force push cleaned history** (coordinate with team first)

## Build-Time Secrets (Advanced)

If you absolutely must pass secrets at build time, use Docker BuildKit secrets:

```dockerfile
# Mount secret at build time (not stored in image layers)
RUN --mount=type=secret,id=nextauth_secret \
    NEXTAUTH_SECRET=$(cat /run/secrets/nextauth_secret) npm run build
```

Build command:
```bash
docker buildx build --secret id=nextauth_secret,src=./secrets.txt .
```

**Note:** For ScheduleOS, runtime secrets (set in Railway Variables) are the recommended approach.

## Current Deployment Configuration

The repository currently uses:
- **nixpacks.toml** - Build configuration for Nixpacks
- **railway.json** - Railway deployment settings

These files do not contain secret defaults and are safe. Continue setting secrets via Railway Project > Variables.
