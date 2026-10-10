import type { LatLng, Venue } from "@/types";

/**
 * Deterministic demo venues, used only when the live Overpass
 * endpoint is unavailable or unconfigured. Always flagged with
 * `demo: true` so the UI can label them honestly.
 *
 * The generator is seeded by the search region so the same
 * region always yields the same demo results.
 */

const DEMO_NAMES: Record<string, string[]> = {
  restaurant: [
    "Ember & Oak Kitchen",
    "The Tandoor Table",
    "Golden Wok House",
    "Nonna's Corner",
  ],
  cafe: [
    "Riverside Café",
    "The Daily Grind",
    "Saffron & Steam",
    "Corner Brew House",
  ],
  park: ["Maple Grove Park", "Riverside Gardens", "Lakeside Green"],
  games: ["Pixel Arcade", "The Game Den", "Escape Room Central"],
  bowling: ["Strike Zone Lanes", "Spin & Bowl"],
  cinema: ["Grand Picture House", "Starlight Cinema"],
};

const DEMO_CUISINES = [
  ["indian"],
  ["chinese"],
  ["italian"],
  ["bakery"],
  [],
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Places a demo venue 0.3–4 km from the region centre. */
function jitter(
  center: LatLng,
  rand: () => number,
): { lat: number; lng: number } {
  const angle = rand() * 2 * Math.PI;
  const distKm = 0.3 + rand() * 3.7;
  return {
    lat: center.lat + (distKm * Math.sin(angle)) / 111.32,
    lng:
      center.lng +
      (distKm * Math.cos(angle)) / (111.32 * Math.cos((center.lat * Math.PI) / 180)),
  };
}

export function demoVenues(
  center: LatLng,
  categories: string[],
): Venue[] {
  const seed = hashString(
    `${center.lat.toFixed(3)},${center.lng.toFixed(3)}:${[...categories]
      .sort()
      .join(",")}`,
  );
  const rand = mulberry32(seed);
  const venues: Venue[] = [];
  const requested = categories.includes("anything")
    ? Object.keys(DEMO_NAMES)
    : categories.filter((c) => DEMO_NAMES[c]);

  let index = 0;
  for (const category of requested) {
    const names = DEMO_NAMES[category];
    const count = 1 + Math.floor(rand() * Math.min(2, names.length));
    for (let i = 0; i < count && index < 10; i++, index++) {
      const name = names[Math.floor(rand() * names.length)];
      const { lat, lng } = jitter(center, rand);
      // Deliberately vary data completeness so completeness scoring
      // and "unknown" labels are exercised.
      const rich = rand() > 0.5;
      venues.push({
        id: `demo/${seed.toString(36)}-${index}`,
        name,
        category,
        categories: [category],
        lat,
        lng,
        address: rich ? "1 Main Street" : undefined,
        cuisine: rich ? DEMO_CUISINES[Math.floor(rand() * DEMO_CUISINES.length)] : undefined,
        openingHours: rich ? "Mo–Fr 09:00–21:00" : undefined,
        website: rich ? "https://example.org" : undefined,
        phone: undefined,
        price: rand() > 0.8 ? 350 : null,
        accessibility: null,
        outdoorSeating: rich && rand() > 0.5 ? true : null,
        tags: {},
        demo: true,
      });
    }
  }
  return venues;
}
