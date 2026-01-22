# Dockerfile Security Notes

## Important: Do NOT Bake Secrets into Docker Images

When building Docker images, **never** include secrets (API keys, authentication tokens, passwords) as default values in `ARG` or `ENV` directives. Secrets baked into images can be extracted from image layers and pose a serious security risk.

## Setting Secrets at Runtime

### For Railway Deployment

ShiftSync is designed to deploy on Railway using Nixpacks. Set all secrets as environment variables in your Railway project:

1. Go to your Railway project dashboard
2. Navigate to **Project > Variables**
3. Add the following required secrets:

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `NEXTAUTH_SECRET` | NextAuth.js session encryption key | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Resend email service API key | Get from [resend.com](https://resend.com) |

Railway will automatically inject these environment variables at runtime, keeping them secure.

### For Docker Builds (if using a custom Dockerfile)

If you create a custom Dockerfile, follow these best practices:

#### ❌ DON'T do this:
```dockerfile
# BAD: Secrets baked into image
ARG NEXTAUTH_SECRET=my-secret-key-here
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ARG RESEND_API_KEY=re_AbCdEfGhIjKlMnOpQrStUvWxYz
ENV RESEND_API_KEY=${RESEND_API_KEY}
```

#### ✅ DO this instead:
```dockerfile
# GOOD: Declare ARGs without defaults
ARG NEXTAUTH_SECRET
ARG RESEND_API_KEY

# Do not set ENV defaults for secrets to avoid leaking them into image layers
# Pass secrets at runtime via docker run -e or deployment platform variables
```

#### For Build-Time Secrets (Advanced)

If you need secrets during the build process (e.g., for private npm registries), use Docker BuildKit secrets:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```

Build with:
```bash
docker buildx build --secret id=npm_token,src=.npmtoken .
```

## NIXPACKS_PATH Configuration

Railway's Nixpacks build system may use `NIXPACKS_PATH` during the build. If your Dockerfile references this variable, declare it with a sensible fallback:

```dockerfile
ARG NIXPACKS_PATH
ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}
```

This ensures the build doesn't fail if the variable is undefined.

## Additional Security Recommendations

1. **Never commit secrets to version control** - Use `.env` files (excluded in `.gitignore`) for local development
2. **Rotate secrets immediately if exposed** - If you accidentally commit a secret, rotate it and remove it from Git history
3. **Use environment-specific secrets** - Different secrets for development, staging, and production
4. **Audit your image layers** - Use `docker history <image>` to inspect layers and ensure no secrets are visible

## References

- [Railway Environment Variables Documentation](https://docs.railway.app/develop/variables)
- [Docker BuildKit Secrets](https://docs.docker.com/build/building/secrets/)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
