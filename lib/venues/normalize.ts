import type { Venue } from "@/types";
import { matchedCategories, venueCuisines } from "@/lib/venues/categories";

/** Raw element shape returned by the Overpass API. */
export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  // Only trust plain numeric price tags (e.g. price=250). Anything like
  // "$$" or "mid" is ambiguous and must stay unknown.
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || tags["addr:suburb"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Normalises one Overpass element into the shared Venue model.
 * Returns null for unusable elements (no name, no coordinates, no category).
 * Missing tags are left undefined — never fabricated.
 */
export function normalizeVenue(el: OsmElement): Venue | null {
  const tags = el.tags ?? {};
  const name = (tags.name ?? "").trim();
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const categories = matchedCategories(tags);
  if (categories.length === 0) return null;

  const seating = tags["outdoor_seating"];

  return {
    id: `${el.type}/${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name,
    category: categories[0],
    categories,
    lat,
    lng,
    address: buildAddress(tags),
    cuisine: venueCuisines(tags),
    openingHours: tags["opening_hours"] || undefined,
    website: tags["website"] || tags["contact:website"] || undefined,
    phone: tags["phone"] || tags["contact:phone"] || undefined,
    price: parsePrice(tags["price"]),
    accessibility: tags["wheelchair"] ?? null,
    outdoorSeating: seating === "yes" ? true : seating === "no" ? false : null,
    tags,
  };
}

/**
 * Deduplicates by stable OSM type/id and keeps the better-tagged record.
 */
export function dedupeVenues(venues: Venue[]): Venue[] {
  const byId = new Map<string, Venue>();
  for (const v of venues) {
    const existing = byId.get(v.id);
    if (!existing) {
      byId.set(v.id, v);
      continue;
    }
    const existingScore = Object.keys(existing.tags).length;
    const candidateScore = Object.keys(v.tags).length;
    if (candidateScore > existingScore) byId.set(v.id, v);
  }
  return [...byId.values()];
}
