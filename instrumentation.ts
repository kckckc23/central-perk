export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("@/lib/db/client");
  try {
    // Idempotent: applies any pending migrations once
    // per server instance, so fresh Vercel deployments
    // are always correctly schema'd.
    await runMigrations();
  } catch (err) {
    // Not fatal at boot — every request retries
    // through the normal error paths.
    console.warn(
      "[spotsync] Database migration skipped at boot:",
      err instanceof Error ? err.message : err,
    );
  }
}
