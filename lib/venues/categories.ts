/**
 * Category → OpenStreetMap tag mapping.
 *
 * The mapping is deliberately configurable: extend `CATEGORIES` to match
 * more OSM tags, or adapt it to a regional extract. Remember that OSM
 * coverage is community-maintained and never complete.
 */

export interface CategoryMapping {
  id: string;
  label: string;
  description: string;
  osm: { key: string; values: string[] }[];
}

export const CATEGORIES: CategoryMapping[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    description: "Full meals, fast food and dinner spots",
    osm: [
      { key: "amenity", values: ["restaurant", "fast_food"] },
    ],
  },
  {
    id: "cafe",
    label: "Café / coffee",
    description: "Coffee shops and casual cafés",
    osm: [{ key: "amenity", values: ["cafe"] }],
  },
  {
    id: "park",
    label: "Park / garden",
    description: "Parks, gardens and picnic spots",
    osm: [
      { key: "leisure", values: ["park", "garden"] },
      { key: "tourism", values: ["picnic_site"] },
    ],
  },
  {
    id: "games",
    label: "Games / arcade",
    description: "Arcades, gaming zones and escape rooms",
    osm: [
      { key: "leisure", values: ["adult_gaming_centre", "amusement_arcade"] },
      { key: "tourism", values: ["escape_game"] },
    ],
  },
  {
    id: "bowling",
    label: "Bowling / indoor",
    description: "Bowling alleys and other indoor activities",
    osm: [{ key: "leisure", values: ["bowling_alley"] }],
  },
  {
    id: "cinema",
    label: "Cinema / entertainment",
    description: "Cinemas and live entertainment",
    osm: [{ key: "amenity", values: ["cinema"] }],
  },
];

/** "Anything is fine" — union of every category above. */
export const ANYTHING_CATEGORY_ID = "anything";

export function categoryById(id: string): CategoryMapping | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id;
}

/** OSM tag filters for the given category ids (or all if "anything"). */
export function osmFiltersFor(categories: string[]): CategoryMapping[] {
  if (categories.includes(ANYTHING_CATEGORY_ID)) return CATEGORIES;
  return CATEGORIES.filter((c) => categories.includes(c.id));
}

/** Cuisine preference options mapped to OSM `cuisine` tag values. */
export const CUISINES: { id: string; label: string; osm: string[] }[] = [
  { id: "indian", label: "Indian", osm: ["indian"] },
  { id: "gujarati", label: "Gujarati", osm: ["gujarati"] },
  { id: "north_indian", label: "North Indian", osm: ["north_indian"] },
  { id: "south_indian", label: "South Indian", osm: ["south_indian"] },
  { id: "chinese", label: "Chinese", osm: ["chinese"] },
  { id: "italian", label: "Italian", osm: ["italian"] },
  { id: "bakery", label: "Café / bakery", osm: ["bakery", "coffee_shop"] },
  { id: "vegetarian", label: "Vegetarian-friendly", osm: ["vegetarian"] },
];

export function cuisineLabel(id: string): string {
  return CUISINES.find((c) => c.id === id)?.label ?? id;
}

/** Optional nice-to-have preference tags (only applied when source data exists). */
export const OPTIONAL_PREFS: { id: string; label: string; tag: string; value: string }[] = [
  { id: "outdoor_seating", label: "Outdoor seating", tag: "outdoor_seating", value: "yes" },
];

/** Matches a venue's OSM tags against a category mapping. */
export function venueMatchesMapping(
  tags: Record<string, string>,
  mapping: CategoryMapping,
): boolean {
  return mapping.osm.some(({ key, values }) =>
    values.some((v) => tags[key] === v),
  );
}

/** All category ids a venue's tags match. */
export function matchedCategories(
  tags: Record<string, string>,
): string[] {
  return CATEGORIES.filter((m) => venueMatchesMapping(tags, m)).map(
    (m) => m.id,
  );
}

/** Cuisine values present in a venue's tags. */
export function venueCuisines(tags: Record<string, string>): string[] {
  const raw = tags["cuisine"];
  if (!raw) return [];
  return raw
    .split(";")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}
