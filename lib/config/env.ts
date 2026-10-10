/**
 * Centralised environment configuration.
 *
 * Every external endpoint is configurable so public community endpoints can
 * later be replaced with self-hosted instances without code changes.
 */

export const env = {
  pocketbaseUrl: process.env.POCKETBASE_URL || "http://127.0.0.1:8090",
  pocketbaseEmail: process.env.POCKETBASE_SUPERUSER_EMAIL || "",
  pocketbasePassword: process.env.POCKETBASE_SUPERUSER_PASSWORD || "",

  // Sign guest session cookies. A dev fallback exists so `npm run dev` works
  // out of the box; production deployments must set a real random value.
  sessionSecret:
    process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me",

  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    "https://tiles.openfreemap.org/styles/liberty",

  // Empty means "not configured" — the app degrades to clearly labelled
  // demo data / disabled search instead of failing.
  photonBaseUrl: process.env.PHOTON_BASE_URL || "",
  overpassBaseUrl: process.env.OVERPASS_BASE_URL || "",

  routingProvider:
    (process.env.ROUTING_PROVIDER || "haversine") === "valhalla" ||
    (process.env.ROUTING_PROVIDER || "haversine") === "osrm"
      ? process.env.ROUTING_PROVIDER
      : "haversine",
  valhallaBaseUrl: process.env.VALHALLA_BASE_URL || "",
  osrmBaseUrl: process.env.OSRM_BASE_URL || "",

  nodeEnv: process.env.NODE_ENV || "development",
} as const;

export type RoutingProviderName = "haversine" | "valhalla" | "osrm";

/** How long a room stays open after creation. */
export const ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** How long the guest session cookie lasts (room expiry is enforced server-side). */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const SESSION_COOKIE_NAME = "spotsync_session";
