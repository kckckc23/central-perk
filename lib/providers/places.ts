import { env } from "@/lib/config/env";
import { ProviderError, cachedFetch } from "@/lib/providers/geocoding";
import { dedupeVenues, normalizeVenue, type OsmElement } from "@/lib/venues/normalize";
import type { LatLng, Venue } from "@/types";
import { osmFiltersFor } from "@/lib/venues/categories";

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Max elements returned per Overpass query — keeps queries small. */
const OVERPASS_LIMIT = 120;

export function bboxAround(center: LatLng, radiusKm: number): BBox {
  // Rough degrees-per-km (good enough for search regions; the scoring
  // uses exact haversine afterwards).
  const latDeg = radiusKm / 111.32;
  const lngDeg = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - latDeg,
    west: center.lng - lngDeg,
    north: center.lat + latDeg,
    east: center.lng + lngDeg,
  };
}

function buildQuery(categories: string[], bbox: BBox): string {
  const filters = new Set<string>();
  for (const mapping of osmFiltersFor(categories)) {
    for (const { key, values } of mapping.osm) {
      for (const value of values) {
        filters.add(
          `nwr["${key}"="${value}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east})`,
        );
      }
    }
  }
  return `[out:json][timeout:25];(${[...filters].join(";")});out center tags ${OVERPASS_LIMIT};`;
}

/**
 * Queries an Overpass-compatible endpoint for venues in the given region.
 * Throws ProviderError when the endpoint is unconfigured or fails, so the
 * caller can decide to fall back to clearly-labelled demo data.
 */
export async function searchVenues(
  center: LatLng,
  radiusKm: number,
  categories: string[],
): Promise<Venue[]> {
  if (!env.overpassBaseUrl) {
    throw new ProviderError(
      "unconfigured",
      "Venue discovery needs an Overpass-compatible endpoint. Set OVERPASS_BASE_URL to enable live OpenStreetMap data.",
    );
  }

  const bbox = bboxAround(center, radiusKm);
  const query = buildQuery(categories, bbox);

  let elements: OsmElement[];
  try {
    const data = (await cachedFetch(
      `overpass:${query}`,
      async () => {
        const res = await fetch(env.overpassBaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "SpotSync/0.1 (open-source meetup spot finder)",
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          let body = "";
          try {
            body = await res.text();
          } catch {
            // ignore body read errors
          }
          console.error(
            "[spotsync] Overpass discovery failed",
            res.status,
            res.statusText,
            body.slice(0, 500),
          );
          if (res.status === 429) {
            throw new ProviderError("rate-limited", "The map-data endpoint is rate-limited. Try again shortly.");
          }
          throw new ProviderError("network", `Map-data endpoint returned ${res.status}.`);
        }
        return res.json();
      },
    )) as { elements?: OsmElement[] };
    elements = data.elements ?? [];
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    if (isTimeout) {
      console.error("[spotsync] Overpass discovery timed out");
    } else {
      console.error("[spotsync] Overpass discovery unreachable", err);
    }
    throw new ProviderError("network", "Map-data endpoint is unreachable right now.");
  }

  const venues = elements
    .map(normalizeVenue)
    .filter((v): v is Venue => v !== null);
  return dedupeVenues(venues);
}
