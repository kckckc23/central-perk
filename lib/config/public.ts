/**
 * Client-safe configuration.
 *
 * Only values derived from NEXT_PUBLIC_
 * variables belong here — everything in this
 * module is intentionally embeddable in the
 * browser bundle. Server-only configuration
 * (database URLs, API keys, private endpoint
 * URLs) lives in lib/config/env.ts and must
 * never be imported from a client component.
 */

export const publicConfig = {
  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    "https://tiles.openfreemap.org/styles/liberty",
} as const;
