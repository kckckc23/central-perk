/**
 * Runs the Postgres integration tests against a
 * temporary embedded Postgres instance — no Neon
 * account or Docker needed.
 *
 *   npm run test:integration
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dir = mkdtempSync(join(tmpdir(), "spotsync-pg-"));
const port = 55432;

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "spotsync",
  password: "spotsync",
  port,
  persistent: false,
});

try {
  await pg.initialise();
  await pg.start();

  const url = `postgresql://spotsync:spotsync@127.0.0.1:${port}/postgres`;
  console.log(`Embedded Postgres ready: ${url}`);

  const vitest = join(
    process.cwd(),
    "node_modules",
    ".bin",
    "vitest",
  );
  const result = spawnSync(
    vitest,
    ["run", "tests/integration.test.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  try {
    await pg.stop();
  } catch {
    // already stopped
  }
  rmSync(dir, { recursive: true, force: true });
}
