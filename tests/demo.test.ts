import { describe, expect, it } from "vitest";
import { demoVenues } from "@/lib/venues/demo";

describe("demo venues", () => {
  it("generates deterministic venues for the same region", () => {
    const center = { lat: 28.6139, lng: 77.209 };
    const first = demoVenues(center, ["cafe", "restaurant"]);
    const second = demoVenues(center, ["cafe", "restaurant"]);
    expect(first.map((v) => v.id)).toEqual(second.map((v) => v.id));
  });

  it("flags every venue as demo data", () => {
    for (const venue of demoVenues({ lat: 1, lng: 1 }, ["cafe"])) {
      expect(venue.demo).toBe(true);
    }
  });

  it("only returns venues in the requested categories", () => {
    const venues = demoVenues({ lat: 1, lng: 1 }, ["park"]);
    expect(venues.length).toBeGreaterThan(0);
    for (const venue of venues) {
      expect(venue.category).toBe("park");
    }
  });

  it("stays within a few km of the region centre", () => {
    const center = { lat: 28.6139, lng: 77.209 };
    for (const venue of demoVenues(center, ["cafe"])) {
      const dLat = Math.abs(venue.lat - center.lat) * 111.32;
      const dLng =
        Math.abs(venue.lng - center.lng) *
        111.32 *
        Math.cos((center.lat * Math.PI) / 180);
      expect(Math.hypot(dLat, dLng)).toBeLessThan(6);
    }
  });
});
