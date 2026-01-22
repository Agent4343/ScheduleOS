# Docker Security Best Practices

## Never Bake Secrets into Docker Images

**DO NOT** commit secret values into Docker images. Set `NEXTAUTH_SECRET` and `RESEND_API_KEY` as environment variables in your deployment platform:

- **Railway**: Set in Project → Variables
- **Vercel**: Set in Project Settings → Environment Variables
- **Other platforms**: Use your hosting provider's environment variable configuration

## Using Docker BuildKit for Build-Time Secrets

If you absolutely need secrets during build time, use Docker BuildKit secrets instead of ARG/ENV:

```dockerfile
# Use BuildKit secret mount (secrets never baked into image layers)
RUN --mount=type=secret,id=mykey \
    export MY_SECRET=$(cat /run/secrets/mykey) && \
    # use secret here
```

Build with:
```bash
docker build --secret id=mykey,src=./secret.txt .
```

## NIXPACKS_PATH Configuration

If using Nixpacks (Railway's default builder), ensure `NIXPACKS_PATH` has a safe fallback:

```dockerfile
ARG NIXPACKS_PATH
ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}
```

This prevents undefined variable errors during Docker lint/build.

## If You Accidentally Committed Secrets

If you accidentally committed secrets to the repository:

1. **Rotate the secrets immediately** - Generate new values for all exposed secrets
2. **Update your deployment** - Set the new secrets in your hosting platform
3. **Remove from history** - Use `git filter-repo` or BFG Repo-Cleaner to remove secrets from Git history:
   ```bash
   # Using git filter-repo (recommended)
   git filter-repo --path-glob '**/*secrets*' --invert-paths
   
   # Or using BFG Repo-Cleaner
   bfg --delete-files secrets.txt
   ```
4. **Force push** - After cleaning history (be careful, coordinate with team)

## Summary

✅ **DO**: Set secrets as environment variables in your deployment platform  
✅ **DO**: Use Docker BuildKit secrets for build-time needs  
✅ **DO**: Rotate secrets immediately if accidentally committed  
❌ **DON'T**: Use ARG/ENV with default secret values in Dockerfiles  
❌ **DON'T**: Commit .env files or secrets to the repository  
