import { ANYTHING_CATEGORY_ID, cuisineLabel } from "@/lib/venues/categories";
import type { RouteResult } from "@/lib/providers/routing";
import type {
  ParticipantPreferences,
  RankedVenue,
  TravelEstimate,
  Venue,
} from "@/types";
import { formatKm } from "@/lib/utils";

/**
 * Deterministic, testable scoring.
 *
 * Weights (tunable, documented in the brief):
 *   45% travel fairness   — average + worst individual travel cost
 *   40% preference match  — categories, cuisines, optional tags
 *   15% information signal — source data completeness (no invented ratings)
 */
export const WEIGHTS = {
  travel: 0.45,
  preference: 0.4,
  completeness: 0.15,
} as const;

export interface ScoredParticipant {
  id: string;
  displayName: string;
  preferences: ParticipantPreferences;
}

export interface ConstraintFailure {
  venueId: string;
  participantId: string;
  displayName: string;
  reasons: string[];
}

/**
 * Hard constraints for one participant against one venue.
 * Returns human-readable failure reasons (empty list = passes).
 * Unknown data is never assumed to fit: an unknown price fails
 * only when the participant disallows unknown prices.
 */
export function checkHardConstraints(
  venue: Venue,
  distanceKm: number,
  prefs: ParticipantPreferences,
  displayName: string,
): string[] {
  const reasons: string[] = [];

  if (
    prefs.categoriesMandatory &&
    prefs.categories.length > 0 &&
    !prefs.categories.includes(ANYTHING_CATEGORY_ID)
  ) {
    const matches = venue.categories.some((c) => prefs.categories.includes(c));
    if (!matches) {
      reasons.push(
        `${displayName} requires one of: ${prefs.categories.join(", ")}`,
      );
    }
  }

  if (prefs.budgetMandatory && prefs.budgetMax != null) {
    if (venue.price == null) {
      if (!prefs.allowUnknownPrice) {
        reasons.push(`${displayName} disallows venues with unknown price`);
      }
    } else if (venue.price > prefs.budgetMax) {
      reasons.push(
        `${displayName}'s budget: over the listed maximum`,
      );
    }
  }

  if (prefs.maxDistanceKm != null && distanceKm > prefs.maxDistanceKm) {
    reasons.push(
      `${displayName}: beyond ${formatKm(prefs.maxDistanceKm)} limit (${formatKm(distanceKm)})`,
    );
  }

  return reasons;
}

function preferenceScoreFor(
  venue: Venue,
  prefs: ParticipantPreferences,
): number {
  // Category (60% of the preference component)
  const noCategoryPref =
    prefs.categories.length === 0 ||
    prefs.categories.includes(ANYTHING_CATEGORY_ID);
  const categoryMatch =
    noCategoryPref || venue.categories.some((c) => prefs.categories.includes(c));
  const categoryComponent = categoryMatch ? 1 : 0;

  // Cuisine (25%). Missing cuisine data is neutral
  // (cannot be verified) — never treated as a match.
  let cuisineComponent = 1;
  if (prefs.cuisines.length > 0) {
    const venueCuisines = venue.cuisine ?? [];
    if (venueCuisines.length === 0) {
      cuisineComponent = 0.5;
    } else {
      const overlap = prefs.cuisines.filter((c) =>
        venueCuisines.includes(c),
      ).length;
      cuisineComponent = overlap / prefs.cuisines.length;
    }
  }

  // Optional nice-to-haves (15%) — unknown data is neutral, not a failure
  const optionalSet = prefs.optional.filter((o) => o === "outdoor_seating");
  let optionalComponent = 1;
  if (optionalSet.length > 0) {
    const matches = optionalSet.filter(
      (o) => venue.outdoorSeating === true,
    );
    optionalComponent = matches.length / optionalSet.length;
  }

  return (
    0.6 * categoryComponent +
    0.25 * cuisineComponent +
    0.15 * optionalComponent
  );
}

function completenessScore(venue: Venue): number {
  const fields = [
    (venue.cuisine ?? []).length > 0,
    Boolean(venue.openingHours),
    Boolean(venue.website),
    Boolean(venue.phone),
    Boolean(venue.address),
  ];
  return fields.filter(Boolean).length / fields.length;
}

export interface DiscoveryInput {
  venues: Venue[];
  participants: ScoredParticipant[];
  /** venueId → participantId → route result */
  routes: Map<string, Map<string, RouteResult>>;
}

export interface DiscoveryOutput {
  ranked: RankedVenue[];
  failures: ConstraintFailure[];
}

/**
 * Applies hard constraints, scores and ranks venues.
 * Pure and deterministic: same input → same order.
 */
export function rankVenues(input: DiscoveryInput): DiscoveryOutput {
  const { venues, participants, routes } = input;
  const failures: ConstraintFailure[] = [];

  // 1. Hard constraints
  const survivors: { venue: Venue; byParticipant: Map<string, RouteResult> }[] = [];
  for (const venue of venues) {
    const byParticipant = routes.get(venue.id) ?? new Map();
    let failed = false;
    for (const p of participants) {
      const distance = byParticipant.get(p.id)?.distanceKm ?? Infinity;
      const reasons = checkHardConstraints(venue, distance, p.preferences, p.displayName);
      if (reasons.length > 0) {
        failures.push({
          venueId: venue.id,
          participantId: p.id,
          displayName: p.displayName,
          reasons,
        });
        failed = true;
      }
    }
    if (!failed) survivors.push({ venue, byParticipant });
  }

  if (survivors.length === 0) {
    return { ranked: [], failures };
  }

  // 2. Travel fairness — normalise average and worst-case across candidates
  const stats = survivors.map(({ venue, byParticipant }) => {
    const ds = participants
      .map((p) => byParticipant.get(p.id)?.distanceKm)
      .filter((d): d is number => d != null && Number.isFinite(d));
    const avg = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
    const worst = ds.length > 0 ? Math.max(...ds) : 0;
    return { venue, byParticipant, avg, worst };
  });
  const avgs = stats.map((s) => s.avg);
  const worsts = stats.map((s) => s.worst);
  const minAvg = Math.min(...avgs);
  const maxAvg = Math.max(...avgs);
  const minWorst = Math.min(...worsts);
  const maxWorst = Math.max(...worsts);

  // 3. Score every survivor
  const ranked: RankedVenue[] = stats.map(({ venue, byParticipant, avg, worst }) => {
    const normAvg = maxAvg === minAvg ? 1 : 1 - (avg - minAvg) / (maxAvg - minAvg);
    const normWorst =
      maxWorst === minWorst ? 1 : 1 - (worst - minWorst) / (maxWorst - minWorst);
    const travel = 100 * (0.5 * normAvg + 0.5 * normWorst);

    const prefScores = participants.map((p) =>
      preferenceScoreFor(venue, p.preferences),
    );
    const preference =
      100 * (prefScores.reduce((a, b) => a + b, 0) / Math.max(1, prefScores.length));

    const completeness = 100 * completenessScore(venue);

    const total =
      WEIGHTS.travel * travel +
      WEIGHTS.preference * preference +
      WEIGHTS.completeness * completeness;

    const matched = participants.filter((p) => {
      const cats = p.preferences.categories;
      return (
        cats.length === 0 ||
        cats.includes(ANYTHING_CATEGORY_ID) ||
        venue.categories.some((c) => cats.includes(c))
      );
    }).length;

    const travelEstimates: TravelEstimate[] = participants.map((p) => {
      const route = byParticipant.get(p.id);
      return {
        participantId: p.id,
        displayName: p.displayName,
        distanceKm: route?.distanceKm ?? 0,
        durationMin: route?.durationMin ?? null,
        mode: p.preferences.travelMode,
        isStraightLine: route?.isStraightLine ?? true,
      };
    });

    const allStraightLine = travelEstimates.every((e) => e.isStraightLine);
    const travelKind = allStraightLine
      ? "straight-line"
      : "estimated route";

    const explanations: string[] = [];
    explanations.push(
      `Balanced travel: on average ${formatKm(avg)}, farthest ${formatKm(worst)} (${travelKind} distance).`,
    );
    explanations.push(
      `Matches ${matched} of ${participants.length} participants' place types.`,
    );
    if ((venue.cuisine ?? []).length > 0) {
      explanations.push(
        `Cuisines: ${venue.cuisine!.map(cuisineLabel).join(", ")}.`,
      );
    }
    explanations.push(
      `Venue data: ${completenessScore(venue).toFixed(0)}% of optional details available.`,
    );

    return {
      ...venue,
      score: {
        total: Math.round(total * 10) / 10,
        travel: Math.round(travel * 10) / 10,
        preference: Math.round(preference * 10) / 10,
        completeness: Math.round(completeness * 10) / 10,
        explanations,
      },
      travel: travelEstimates,
    };
  });

  ranked.sort((a, b) => b.score.total - a.score.total || a.id.localeCompare(b.id));
  return { ranked, failures };
}
