# Dockerfile Security Notes

Do NOT bake secret values into Docker images.

- Set NEXTAUTH_SECRET and RESEND_API_KEY as runtime environment variables in Railway (Project -> Variables) or your hosting provider.
- If you need build-time secrets, use Docker BuildKit: `docker build --secret id=mysecret,src=/path/to/secret` and do not commit defaults to the repository.
- To avoid undefined variable issues with nixpacks, add this fallback snippet in your Dockerfile or build config:

  ```
  ARG NIXPACKS_PATH
  ENV NIXPACKS_PATH=${NIXPACKS_PATH:-/usr/local/nixpacks}
  ```

- If secrets were committed historically, rotate them immediately and remove them from repository history using git filter-repo or BFG.
