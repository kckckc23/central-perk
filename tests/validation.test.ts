import { describe, expect, it } from "vitest";
import { parseBody, preferencesSchema, locationSchema, createRoomSchema } from "@/lib/validation";

describe("validation", () => {
  it("accepts a valid room creation payload", () => {
    const result = parseBody(createRoomSchema, {
      name: "Saturday hangout",
      displayName: "Alex",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects empty room names", () => {
    const result = parseBody(createRoomSchema, { name: "   ", displayName: "Alex" });
    expect(result.ok).toBe(false);
  });

  it("accepts valid preferences and normalises nothing silently", () => {
    const result = parseBody(preferencesSchema, {
      categories: ["cafe", "park"],
      cuisines: [],
      budgetMin: null,
      budgetMax: 500,
      budgetMandatory: true,
      allowUnknownPrice: true,
      categoriesMandatory: false,
      maxDistanceKm: 5,
      travelMode: "bike",
      optional: ["outdoor_seating"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.categories).toEqual(["cafe", "park"]);
      expect(result.data.travelMode).toBe("bike");
    }
  });

  it("rejects invalid travel modes and out-of-range coordinates", () => {
    expect(parseBody(preferencesSchema, { travelMode: "teleport" }).ok).toBe(false);
    expect(
      parseBody(locationSchema, { label: "X", lat: 91, lng: 0, precision: "gps" }).ok,
    ).toBe(false);
    expect(
      parseBody(locationSchema, { label: "X", lat: 10, lng: 10, precision: "magic" }).ok,
    ).toBe(false);
  });
});
