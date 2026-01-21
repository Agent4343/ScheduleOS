export async function register() {
  // Only run on the server side in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runAutoMigrations } = await import('./lib/auto-migrate')
    await runAutoMigrations()
  }
}
