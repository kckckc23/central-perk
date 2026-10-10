import { env } from "@/lib/config/env";
import {
  getRouteTable,
  haversineKm,
  type RouteResult,
} from "@/lib/providers/routing";
import { demoVenues } from "@/lib/venues/demo";
import { ANYTHING_CATEGORY_ID } from "@/lib/venues/categories";
import { rankVenues, type ScoredParticipant } from "@/lib/recommendations/scoring";
import { searchVenues } from "@/lib/providers/places";
import type { LatLng, RankedVenue, Venue } from "@/types";

export interface DiscoveryParticipant extends ScoredParticipant {
  lat: number;
  lng: number;
}

export interface DiscoveryResult {
  venues: RankedVenue[];
  /** True when results come from the built-in demo data set. */
  demo: boolean;
  /** Human-readable notices about data source or degraded routing. */
  notices: string[];
  /** Failure reasons for venues excluded by hard constraints. */
  failures: { venueId: string; reasons: string[] }[];
  center: LatLng;
  radiusKm: number;
}

const MIN_RADIUS_KM = 2;
const MAX_RADIUS_KM = 25;

/**
 * End-to-end discovery:
 * region from participant locations → candidate venues →
 * per-participant travel → hard constraints → scored ranking.
 */
export async function discoverVenues(
  participants: DiscoveryParticipant[],
): Promise<DiscoveryResult> {
  if (participants.length === 0) {
    throw new Error("At least one participant location is required.");
  }

  // 1. Region: centroid of all starting points, radius covers the
  //    most distant participant plus a margin for candidate venues.
  const center: LatLng = {
    lat: participants.reduce((a, p) => a + p.lat, 0) / participants.length,
    lng: participants.reduce((a, p) => a + p.lng, 0) / participants.length,
  };
  const maxSpread = Math.max(
    ...participants.map((p) => haversineKm(center, p)),
  );
  const radiusKm = Math.min(
    MAX_RADIUS_KM,
    Math.max(MIN_RADIUS_KM, maxSpread + 2),
  );

  // 2. Categories: union of all participants' requests.
  const categorySet = new Set<string>();
  for (const p of participants) {
    for (const c of p.preferences.categories) categorySet.add(c);
  }
  const categories =
    categorySet.size === 0 ? [ANYTHING_CATEGORY_ID] : [...categorySet];

  // 3. Candidate venues, with honest degradation to demo data.
  const notices: string[] = [];
  let venues: Venue[];
  let demo = false;
  try {
    venues = await searchVenues(center, radiusKm, categories);
    if (venues.length === 0) {
      notices.push(
        "No OpenStreetMap venues matched in this region. The map data may simply not cover these places.",
      );
    }
  } catch (err) {
    demo = true;
    venues = demoVenues(center, categories);
    notices.push(
      "Showing demo venues — the live map-data endpoint is unavailable or not configured. Configure OVERPASS_BASE_URL to see real places.",
    );
  }

  // 4. Per-participant travel estimates.
  const routes = new Map<string, Map<string, RouteResult>>();
  let routingDegraded = false;
  for (const p of participants) {
    try {
      const { results, degraded } = await getRouteTableWithStatus(
        { lat: p.lat, lng: p.lng },
        venues,
        p.preferences.travelMode,
      );
      if (degraded) routingDegraded = true;
      venues.forEach((v, i) => {
        if (!routes.has(v.id)) routes.set(v.id, new Map());
        routes.get(v.id)!.set(p.id, results[i]);
      });
    } catch {
      // Should not happen (haversine always works) — keep going.
      venues.forEach((v) => {
        if (!routes.has(v.id)) routes.set(v.id, new Map());
        routes.get(v.id)!.set(p.id, {
          distanceKm: haversineKm({ lat: p.lat, lng: p.lng }, v),
          durationMin: null,
          isStraightLine: true,
        });
      });
    }
  }
  if (routingDegraded) {
    notices.push(
      "The configured routing engine was unreachable — distances shown are straight-line, not road distances.",
    );
  } else if (env.routingProvider === "haversine") {
    notices.push(
      "No routing engine configured — distances are straight-line, not road distances or travel times.",
    );
  }

  // 5. Constraints + scoring.
  const { ranked, failures } = rankVenues({
    venues,
    participants,
    routes,
  });

  return {
    venues: ranked,
    demo,
    notices,
    failures: failures.reduce(
      (acc, f) => {
        const existing = acc.find((x) => x.venueId === f.venueId);
        if (existing) existing.reasons.push(...f.reasons);
        else acc.push({ venueId: f.venueId, reasons: [...f.reasons] });
        return acc;
      },
      [] as { venueId: string; reasons: string[] }[],
    ),
    center,
    radiusKm,
  };
}

async function getRouteTableWithStatus(
  origin: LatLng,
  destinations: Venue[],
  mode: Parameters<typeof getRouteTable>[2],
): Promise<{ results: RouteResult[]; degraded: boolean }> {
  const results = await getRouteTable(origin, destinations, mode);
  // getRouteTable falls back internally; detect degradation by
  // checking whether a router was even configured.
  const routerConfigured =
    (env.routingProvider === "valhalla" && Boolean(env.valhallaBaseUrl)) ||
    (env.routingProvider === "osrm" && Boolean(env.osrmBaseUrl));
  const degraded = routerConfigured && results.every((r) => r.isStraightLine);
  return { results, degraded };
}
