import { describe, expect, it } from "vitest";
import { dedupeVenues, normalizeVenue } from "@/lib/venues/normalize";

describe("normalizeVenue", () => {
  it("normalises a café node", () => {
    const venue = normalizeVenue({
      type: "node",
      id: 123,
      lat: 28.6139,
      lon: 77.209,
      tags: {
        name: "Test Café",
        amenity: "cafe",
        cuisine: "italian;bakery",
        opening_hours: "Mo-Fr 09:00-21:00",
        website: "https://example.org",
        phone: "+91 12345",
        "addr:street": "Main Road",
        "addr:housenumber": "12",
        outdoor_seating: "yes",
      },
    });
    expect(venue).not.toBeNull();
    expect(venue!.id).toBe("node/123");
    expect(venue!.category).toBe("cafe");
    expect(venue!.name).toBe("Test Café");
    expect(venue!.cuisine).toEqual(["italian", "bakery"]);
    expect(venue!.address).toBe("12 Main Road");
    expect(venue!.outdoorSeating).toBe(true);
    expect(venue!.price).toBeNull();
  });

  it("matches multiple categories", () => {
    const venue = normalizeVenue({
      type: "way",
      id: 456,
      center: { lat: 1, lon: 2 },
      tags: { name: "Multi", amenity: "restaurant", cuisine: "indian" },
    });
    expect(venue!.categories).toContain("restaurant");
    expect(venue!.osmType).toBe("way");
  });

  it("rejects unnamed venues", () => {
    expect(
      normalizeVenue({ type: "node", id: 1, lat: 0, lon: 0, tags: { amenity: "cafe" } }),
    ).toBeNull();
  });

  it("rejects venues without coordinates", () => {
    expect(
      normalizeVenue({ type: "node", id: 1, tags: { name: "X", amenity: "cafe" } }),
    ).toBeNull();
  });

  it("rejects venues with no matching category tags", () => {
    expect(
      normalizeVenue({ type: "node", id: 1, lat: 0, lon: 0, tags: { name: "Shop", shop: "books" } }),
    ).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      normalizeVenue({ type: "node", id: 1, lat: 200, lon: 0, tags: { name: "X", amenity: "cafe" } }),
    ).toBeNull();
  });

  it("only trusts plain numeric price tags", () => {
    expect(
      normalizeVenue({ type: "node", id: 1, lat: 0, lon: 0, tags: { name: "A", amenity: "cafe", price: "250" } })!.price,
    ).toBe(250);
    expect(
      normalizeVenue({ type: "node", id: 2, lat: 0, lon: 0, tags: { name: "B", amenity: "cafe", price: "$$" } })!.price,
    ).toBeNull();
  });
});

describe("dedupeVenues", () => {
  it("deduplicates by stable OSM id keeping richer tags", () => {
    const basic = normalizeVenue({
      type: "node",
      id: 100,
      lat: 1,
      lon: 1,
      tags: { name: "Dup", amenity: "cafe" },
    })!;
    const rich = normalizeVenue({
      type: "node",
      id: 100,
      lat: 1,
      lon: 1,
      tags: { name: "Dup", amenity: "cafe", website: "https://x.org" },
    })!;
    const result = dedupeVenues([basic, rich]);
    expect(result.length).toBe(1);
    expect(result[0].website).toBe("https://x.org");
  });
});
