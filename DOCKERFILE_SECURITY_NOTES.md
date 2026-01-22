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
   # First, identify which files/commits contain secrets
   git log -p --all -S "your-secret-keyword" --source --all
   
   # Using BFG Repo-Cleaner to replace secret strings (recommended)
   # Create a file with secret strings to replace, one per line
   echo "sk_live_secret123" >> secrets.txt
   echo "supersecretvalue" >> secrets.txt
   bfg --replace-text secrets.txt
   
   # Or to delete specific files completely
   bfg --delete-files 'secrets.env'
   
   # Using git filter-repo to remove specific files
   git filter-repo --path 'path/to/secret-file.env' --invert-paths
   
   # Or to remove text patterns from all files
   git filter-repo --replace-text <(echo "regex:sk_live_[a-zA-Z0-9]+==>***REMOVED***")
   ```
4. **Force push** - After cleaning history (be careful, coordinate with team)

## Summary

✅ **DO**: Set secrets as environment variables in your deployment platform  
✅ **DO**: Use Docker BuildKit secrets for build-time needs  
✅ **DO**: Rotate secrets immediately if accidentally committed  
❌ **DON'T**: Use ARG/ENV with default secret values in Dockerfiles  
❌ **DON'T**: Commit .env files or secrets to the repository  
