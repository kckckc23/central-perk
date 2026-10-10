export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureCollections } = await import("@/lib/db/setup");
  try {
    await ensureCollections();
  } catch (err) {
    // Not fatal: PocketBase may still be starting up.
    // Every API request retries automatically.
    console.warn(
      "[spotsync] PocketBase not ready at boot:",
      err instanceof Error ? err.message : err,
    );
  }
}
