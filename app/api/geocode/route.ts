import { NextRequest } from "next/server";
import { ProviderError, searchPlaces } from "@/lib/providers/geocoding";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk } from "@/lib/api";

/**
 * Server-side place autocomplete.
 *
 * Photon's base URL comes from PHOTON_BASE_URL,
 * a server-only variable — the browser never
 * sees it. Client components must call this
 * route instead of importing searchPlaces
 * directly.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  // Short queries return an empty list instead of
  // hammering the geocoding endpoint.
  if (q.length < 2) {
    return apiOk({ results: [] });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  if (!rateLimit(`geocode:${clientIp}`, 30, 60_000)) {
    return apiOk({
      results: [],
      error: "Too many searches. Please wait a moment.",
    });
  }

  try {
    const results = await searchPlaces(q);
    return apiOk({ results });
  } catch (err) {
    // Photon failures degrade to an empty list so
    // the client shows "No places found" instead
    // of crashing.
    return apiOk({
      results: [],
      error:
        err instanceof ProviderError
          ? err.message
          : "Place search is unavailable right now.",
    });
  }
}
