import { describe, expect, it } from "vitest";
import { rankVenues, checkHardConstraints } from "@/lib/recommendations/scoring";
import type { ParticipantPreferences, Venue } from "@/types";

function prefs(
  overrides: Partial<ParticipantPreferences> = {},
): ParticipantPreferences {
  return {
    participantId: "p1",
    categories: [],
    cuisines: [],
    budgetMin: null,
    budgetMax: null,
    budgetMandatory: false,
    allowUnknownPrice: true,
    categoriesMandatory: false,
    maxDistanceKm: null,
    travelMode: "foot",
    optional: [],
    updated: "",
    ...overrides,
  };
}

function venue(
  id: string,
  overrides: Partial<Venue> = {},
): Venue {
  return {
    id,
    name: `Venue ${id}`,
    category: "cafe",
    categories: ["cafe"],
    lat: 0,
    lng: 0,
    price: null,
    outdoorSeating: null,
    tags: {},
    ...overrides,
  };
}

describe("checkHardConstraints", () => {
  it("passes when no constraints are set", () => {
    expect(
      checkHardConstraints(venue("v"), 5, prefs(), "Alex"),
    ).toEqual([]);
  });

  it("excludes non-matching categories when categories are mandatory", () => {
    const reasons = checkHardConstraints(
      venue("v", { categories: ["park"], category: "park" }),
      1,
      prefs({
        categories: ["cafe"],
        categoriesMandatory: true,
      }),
      "Alex",
    );
    expect(reasons.length).toBe(1);
    expect(reasons[0]).toContain("cafe");
  });

  it("allows matching categories when mandatory", () => {
    expect(
      checkHardConstraints(
        venue("v", { categories: ["cafe", "restaurant"] }),
        1,
        prefs({
          categories: ["restaurant"],
          categoriesMandatory: true,
        }),
        "Alex",
      ),
    ).toEqual([]);
  });

  it("excludes over-budget venues when budget is mandatory", () => {
    const reasons = checkHardConstraints(
      venue("v", { price: 800 }),
      1,
      prefs({ budgetMax: 500, budgetMandatory: true }),
      "Alex",
    );
    expect(reasons.length).toBe(1);
    expect(reasons[0]).toContain("budget");
  });

  it("treats unknown price as a failure only when disallowed", () => {
    expect(
      checkHardConstraints(venue("v", { price: null }), 1, prefs({ budgetMax: 500, budgetMandatory: true, allowUnknownPrice: false }), "Alex").length,
    ).toBe(1);
    expect(
      checkHardConstraints(venue("v", { price: null }), 1, prefs({ budgetMax: 500, budgetMandatory: true, allowUnknownPrice: true }), "Alex").length,
    ).toBe(0);
  });

  it("excludes venues beyond the max straight-line distance", () => {
    expect(
      checkHardConstraints(venue("v"), 12, prefs({ maxDistanceKm: 5 }), "Alex").length,
    ).toBe(1);
    expect(
      checkHardConstraints(venue("v"), 3, prefs({ maxDistanceKm: 5 }), "Alex").length,
    ).toBe(0);
  });
});

describe("rankVenues", () => {
  const participants = [
    { id: "p1", displayName: "Alex", preferences: prefs() },
    { id: "p2", displayName: "Sam", preferences: prefs() },
  ];

  function routes(
    distances: Record<string, Record<string, number>>,
  ) {
    const map = new Map();
    for (const [venueId, byParticipant] of Object.entries(distances)) {
      const inner = new Map();
      for (const [participantId, km] of Object.entries(byParticipant)) {
        inner.set(participantId, {
          distanceKm: km,
          durationMin: null,
          isStraightLine: true,
        });
      }
      map.set(venueId, inner);
    }
    return map;
  }

  it("rewards balanced travel over a lopsided alternative", () => {
    // Balanced: 1 km and 3 km. Lopsided: 0.5 km and 10 km.
    const result = rankVenues({
      venues: [venue("balanced"), venue("lopsided")],
      participants,
      routes: routes({
        balanced: { p1: 1, p2: 3 },
        lopsided: { p1: 0.5, p2: 10 },
      }),
    });
    expect(result.ranked[0].id).toBe("balanced");
    expect(result.ranked[0].score.travel).toBeGreaterThan(
      result.ranked[1].score.travel,
    );
  });

  it("is deterministic for identical input", () => {
    const input = {
      venues: [venue("a"), venue("b"), venue("c")],
      participants,
      routes: routes({
        a: { p1: 2, p2: 4 },
        b: { p1: 3, p2: 3 },
        c: { p1: 1, p2: 6 },
      }),
    };
    const first = rankVenues(input);
    const second = rankVenues(input);
    expect(first.ranked.map((v) => v.id)).toEqual(
      second.ranked.map((v) => v.id),
    );
    expect(first.ranked.map((v) => v.score.total)).toEqual(
      second.ranked.map((v) => v.score.total),
    );
  });

  it("excludes venues failing any participant's hard constraints", () => {
    const result = rankVenues({
      venues: [venue("too-far"), venue("ok")],
      participants: [
        {
          id: "p1",
          displayName: "Alex",
          preferences: prefs({ maxDistanceKm: 2 }),
        },
        participants[1],
      ],
      routes: routes({
        "too-far": { p1: 9, p2: 1 },
        ok: { p1: 1, p2: 1 },
      }),
    });
    expect(result.ranked.map((v) => v.id)).toEqual(["ok"]);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("boosts venues matching requested cuisines", () => {
    const withCuisine = rankVenues({
      venues: [venue("indian", { cuisine: ["indian"] })],
      participants: [
        {
          id: "p1",
          displayName: "Alex",
          preferences: prefs({ cuisines: ["indian"] }),
        },
      ],
      routes: routes({ indian: { p1: 2 } }),
    });
    const withoutCuisine = rankVenues({
      venues: [venue("plain", { cuisine: [] })],
      participants: [
        {
          id: "p1",
          displayName: "Alex",
          preferences: prefs({ cuisines: ["indian"] }),
        },
      ],
      routes: routes({ plain: { p1: 2 } }),
    });
    expect(withCuisine.ranked[0].score.preference).toBeGreaterThan(
      withoutCuisine.ranked[0].score.preference,
    );
  });

  it("uses data completeness as the information signal", () => {
    const rich = venue("rich", {
      cuisine: ["italian"],
      openingHours: "09:00-21:00",
      website: "https://example.org",
      phone: "+39 123",
      address: "1 Piazza",
    });
    const bare = venue("bare");
    const result = rankVenues({
      venues: [rich, bare],
      participants,
      routes: routes({ rich: { p1: 2, p2: 2 }, bare: { p1: 2, p2: 2 } }),
    });
    expect(result.ranked[0].id).toBe("rich");
    expect(result.ranked[0].score.completeness).toBe(100);
    expect(result.ranked[1].score.completeness).toBe(0);
  });

  it("scores a single candidate at travel = 100", () => {
    const result = rankVenues({
      venues: [venue("only")],
      participants,
      routes: routes({ only: { p1: 4, p2: 8 } }),
    });
    expect(result.ranked[0].score.travel).toBe(100);
  });
});
