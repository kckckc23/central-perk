import { env } from "@/lib/config/env";
import type { GeocodingResult } from "@/types";

export class ProviderError extends Error {
  readonly kind: "unconfigured" | "network" | "rate-limited" | "invalid-response";

  constructor(kind: ProviderError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

export function cachedFetch(
  key: string,
  loader: () => Promise<unknown>,
): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.data);
  }
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict the oldest entries (good enough for an MVP single-process cache).
    const oldest = [...cache.keys()].slice(0, 20);
    for (const k of oldest) cache.delete(k);
  }
  return loader().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
}

export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (!env.photonBaseUrl) {
    throw new ProviderError(
      "unconfigured",
      "Manual place search needs a Photon-compatible geocoding endpoint. Set PHOTON_BASE_URL or use current location instead.",
    );
  }

  const base = env.photonBaseUrl.replace(/\/$/, "");
  const queryParams = `q=${encodeURIComponent(q)}&limit=6`;
  const url = `${base}?${queryParams}`;

  let data: {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: { name?: string; city?: string; state?: string; country?: string };
    }[];
  };
  try {
    data = (await cachedFetch(`photon:${q}`, async () => {
      let res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        if (res.status === 429) {
          throw new ProviderError("rate-limited", "Geocoding service is rate-limited. Try again shortly.");
        }
        throw new ProviderError("network", `Geocoding endpoint returned ${res.status}.`);
      }
      // The public Photon instance serves an HTML
      // page at its root and the API under /api;
      // self-hosted instances serve the API at the
      // root. If we got HTML, retry once under /api.
      if (
        !/\/api\/?$/.test(base) &&
        (res.headers.get("content-type") ?? "").includes("text/html")
      ) {
        res = await fetch(`${base}/api?${queryParams}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          if (res.status === 429) {
            throw new ProviderError("rate-limited", "Geocoding service is rate-limited. Try again shortly.");
          }
          throw new ProviderError("network", `Geocoding endpoint returned ${res.status}.`);
        }
      }
      return res.json();
    })) as typeof data;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError("network", "Geocoding endpoint is unreachable right now.");
  }

  return (data.features ?? [])
    .filter((f) => f.geometry?.coordinates?.length === 2)
    .map((f) => {
      const p = f.properties ?? {};
      const parts = [p.name, p.city, p.state, p.country].filter(
        (x): x is string => Boolean(x),
      );
      return {
        label: parts.join(", ") || "Unknown place",
        lat: f.geometry!.coordinates![1],
        lng: f.geometry!.coordinates![0],
        context: [p.city, p.country].filter(Boolean).join(", ") || undefined,
      };
    });
}
