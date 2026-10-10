import { env } from "@/lib/config/env";

/**
 * Minimal PocketBase REST client.
 *
 * The browser never talks to PocketBase directly — all access
 * goes through Next.js API routes using the server-side
 * superuser token. Collection API rules are locked down
 * accordingly (see lib/db/setup.ts).
 */

export class PocketBaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface PbRecord {
  id: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

let tokenCache: { token: string; obtainedAt: number } | null = null;
const TOKEN_TTL_MS = 60 * 60 * 1000;

async function superuserToken(): Promise<string> {
  if (!env.pocketbaseEmail || !env.pocketbasePassword) {
    throw new PocketBaseError(
      "PocketBase superuser credentials are not configured. Set POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD (see README).",
      500,
    );
  }
  if (tokenCache && Date.now() - tokenCache.obtainedAt < TOKEN_TTL_MS) {
    return tokenCache.token;
  }
  const res = await fetch(
    `${env.pocketbaseUrl}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: env.pocketbaseEmail,
        password: env.pocketbasePassword,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) {
    throw new PocketBaseError(
      `PocketBase authentication failed (${res.status}). Is PocketBase running at ${env.pocketbaseUrl}?`,
      res.status,
    );
  }
  const data = (await res.json()) as { token: string };
  tokenCache = { token: data.token, obtainedAt: Date.now() };
  return data.token;
}

export async function pbRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const doRequest = async (token: string): Promise<Response> => {
    const url = new URL(`${env.pocketbaseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }
    return fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  };

  let res = await doRequest(await superuserToken());
  if (res.status === 401) {
    tokenCache = null;
    res = await doRequest(await superuserToken());
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PocketBaseError(
      `PocketBase request failed (${res.status}): ${detail.slice(0, 200)}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listRecords<T extends PbRecord>(
  collection: string,
  filter: string,
  expand?: string,
): Promise<T[]> {
  const data = await pbRequest<{ items: T[] }>(
    "GET",
    `/api/collections/${collection}/records`,
    undefined,
    { filter, page: "1", perPage: "200", ...(expand ? { expand } : {}) },
  );
  return data.items;
}

export async function getRecord<T extends PbRecord>(
  collection: string,
  id: string,
  expand?: string,
): Promise<T> {
  return pbRequest<T>(
    "GET",
    `/api/collections/${collection}/records/${id}`,
    undefined,
    expand ? { expand } : undefined,
  );
}

export async function createRecord<T extends PbRecord>(
  collection: string,
  body: Record<string, unknown>,
): Promise<T> {
  return pbRequest<T>("POST", `/api/collections/${collection}/records`, body);
}

export async function updateRecord<T extends PbRecord>(
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  return pbRequest<T>(
    "PATCH",
    `/api/collections/${collection}/records/${id}`,
    body,
  );
}

export async function deleteRecord(
  collection: string,
  id: string,
): Promise<void> {
  await pbRequest("DELETE", `/api/collections/${collection}/records/${id}`);
}

/** Escapes a value for use inside a PocketBase filter string. */
export function filterValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
