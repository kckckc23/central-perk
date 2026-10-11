/**
 * Manual migration runner: `npm run db:migrate`
 *
 * Runs the same versioned migrations that run
 * automatically on server boot. Requires
 * DATABASE_URL to be set (e.g. from a Neon
 * database created in the Vercel dashboard).
 */
import { runMigrations } from "../lib/db/client.ts";
import { db } from "../lib/db/client.ts";

async function main() {
  console.log("Running database migrations…");
  await runMigrations();
  console.log("Migrations applied.");
  await db().end();
}

main().catch((err) => {
  console.error(
    "Migration failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
