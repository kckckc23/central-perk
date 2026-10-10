import { env, type RoutingProviderName } from "@/lib/config/env";
import type { LatLng, TravelMode } from "@/types";

export interface RouteResult {
  distanceKm: number;
  /** Only set when a real routing engine computed it. */
  durationMin: number | null;
  isStraightLine: boolean;
}

export interface RoutingAdapter {
  name: RoutingProviderName;
  /**
   * Distances from one origin to many destinations.
   * Implementations must throw on failure so the caller can degrade to
   * haversine rather than silently reporting wrong numbers.
   */
  getTable(origin: LatLng, destinations: LatLng[], mode: TravelMode): Promise<RouteResult[]>;
}

/**
 * Haversine great-circle distance in kilometres.
 * This is a straight-line distance — NOT road distance or travel time.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

const haversineAdapter: RoutingAdapter = {
  name: "haversine",
  async getTable(origin, destinations) {
    return destinations.map((d) => ({
      distanceKm: haversineKm(origin, d),
      durationMin: null,
      isStraightLine: true,
    }));
  },
};

const COSTING: Record<TravelMode, string> = {
  foot: "pedestrian",
  bike: "bicycle",
  car: "auto",
};

const valhallaAdapter: RoutingAdapter = {
  name: "valhalla",
  async getTable(origin, destinations, mode) {
    const res = await fetch(`${env.valhallaBaseUrl.replace(/\/$/, "")}/matrix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [origin, ...destinations].map((l) => ({ lat: l.lat, lon: l.lng })),
        costing: COSTING[mode],
        units: "kilometers",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Valhalla returned ${res.status}`);
    const data = (await res.json()) as {
      sources_to_targets?: { distance?: number; time?: number }[][];
    };
    const rows = data.sources_to_targets?.[0];
    if (!rows || rows.length !== destinations.length) {
      throw new Error("Valhalla returned an unexpected matrix shape");
    }
    return rows.map((cell) => {
      const distance = cell.distance;
      if (distance == null || !Number.isFinite(distance) || distance < 0) {
        throw new Error("Valhalla returned an invalid distance");
      }
      return {
        distanceKm: distance,
        durationMin:
          cell.time != null && Number.isFinite(cell.time)
            ? cell.time / 60
            : null,
        isStraightLine: false,
      };
    });
  },
};

const OSRM_PROFILE: Record<TravelMode, string> = {
  car: "driving",
  foot: "foot",
  bike: "bike",
};

const osrmAdapter: RoutingAdapter = {
  name: "osrm",
  async getTable(origin, destinations, mode) {
    const coords = [origin, ...destinations]
      .map((l) => `${l.lng},${l.lat}`)
      .join(";");
    const url = `${env.osrmBaseUrl.replace(
      /\/$/,
      "",
    )}/table/v1/${OSRM_PROFILE[mode]}/${coords}?annotations=distance,duration`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = (await res.json()) as {
      distances?: (number | null)[][];
      durations?: (number | null)[][];
    };
    const row = data.distances?.[0];
    if (!row || row.length !== destinations.length) {
      throw new Error("OSRM returned an unexpected table shape");
    }
    return row.map((distance, i) => {
      if (distance == null || !Number.isFinite(distance) || distance < 0) {
        throw new Error("OSRM returned an invalid distance");
      }
      const duration = data.durations?.[0]?.[i];
      return {
        distanceKm: distance / 1000,
        durationMin:
          duration != null && Number.isFinite(duration) ? duration / 60 : null,
        isStraightLine: false,
      };
    });
  },
};

function configuredAdapter(): RoutingAdapter {
  switch (env.routingProvider) {
    case "valhalla":
      return env.valhallaBaseUrl ? valhallaAdapter : haversineAdapter;
    case "osrm":
      return env.osrmBaseUrl ? osrmAdapter : haversineAdapter;
    default:
      return haversineAdapter;
  }
}

/**
 * Returns per-destination route results from the configured provider.
 * If a self-hosted router is configured but fails, results degrade to
 * labelled straight-line haversine distances (never fake road times).
 */
export async function getRouteTable(
  origin: LatLng,
  destinations: LatLng[],
  mode: TravelMode,
): Promise<RouteResult[]> {
  const adapter = configuredAdapter();
  if (adapter.name === "haversine") {
    return adapter.getTable(origin, destinations, mode);
  }
  try {
    return await adapter.getTable(origin, destinations, mode);
  } catch {
    return haversineAdapter.getTable(origin, destinations, mode);
  }
}
