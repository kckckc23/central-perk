import { publicConfig } from "./public";

/**
 * Centralised environment configuration.
 *
 * Every external endpoint is configurable so public community endpoints can
 * later be replaced with self-hosted instances without code changes.
 *
 * SERVER-ONLY: this module reads secret and
 * server-only variables. Never import it from
 * a client component — use lib/config/public.ts.
 */

export const env = {
  // Neon Serverless Postgres connection string
  // (created via the Vercel Marketplace Neon integration).
  databaseUrl: process.env.DATABASE_URL || "",

  // Sign guest session cookies. A dev fallback exists so
  // `npm run dev` works out of the box; production
  // deployments must set a real random value.
  sessionSecret:
    process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me",

  mapStyleUrl: publicConfig.mapStyleUrl,

  // Photon geocoding endpoint. The public instance
  // serves its API under /api (the root is an HTML
  // page); self-hosted instances serve the API at
  // the root, which searchPlaces also handles.
  photonBaseUrl:
    process.env.PHOTON_BASE_URL ||
    "https://photon.komoot.io/api",
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
