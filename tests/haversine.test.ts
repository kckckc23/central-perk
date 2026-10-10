import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/providers/routing";

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    const point = { lat: 51.5074, lng: -0.1278 };
    expect(haversineKm(point, point)).toBeCloseTo(0, 5);
  });

  it("computes London → Paris as roughly 343 km", () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const distance = haversineKm(london, paris);
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(346);
  });

  it("is symmetric", () => {
    const a = { lat: 28.6139, lng: 77.209 };
    const b = { lat: 19.076, lng: 72.8777 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 8);
  });

  it("computes Delhi → Mumbai as roughly 1,150 km", () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const distance = haversineKm(delhi, mumbai);
    expect(distance).toBeGreaterThan(1140);
    expect(distance).toBeLessThan(1160);
  });
});
