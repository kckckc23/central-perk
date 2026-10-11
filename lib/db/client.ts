import postgres, { type Sql } from "postgres";
import { migrations } from "./schema.ts";

/**
 * Neon Serverless Postgres client.
 *
 * The connection string comes from DATABASE_URL,
 * which the Vercel Marketplace Neon integration
 * creates automatically. Only the pooled URL is
 * used — one connection per serverless instance.
 *
 * The browser never receives database credentials:
 * this module is only imported by server code.
 */

type SqlClient = Sql;

let client: SqlClient | null = null;

export class DatabaseError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

export function db(): SqlClient {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new DatabaseError(
        "DATABASE_URL is not configured. Add the Neon database from the Vercel Marketplace (Project → Storage → Neon) and redeploy.",
      );
    }
    client = postgres(url, {
      max: 1, // serverless: at most one connection per instance
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 10,
    });
  }
  return client;
}

/** True when the error is a unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Applies pending migrations inside a transaction.
 * Idempotent — safe to run on every server boot,
 * which is how Vercel deployments self-heal.
 */
export async function runMigrations(): Promise<void> {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  for (const migration of migrations) {
    const applied = await sql`
      SELECT 1 FROM schema_migrations WHERE name = ${migration.name}
    `;
    if (applied.length > 0) continue;

    await sql.begin(async (tx) => {
      for (const statement of migration.statements) {
        await tx.unsafe(statement);
      }
      await tx`
        INSERT INTO schema_migrations (name) VALUES (${migration.name})
      `;
    });
  }
}
