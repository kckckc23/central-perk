import { z } from "zod";

/**
 * Server-side input validation. Never trust client payloads —
 * PocketBase rules are empty and every route validates here.
 */

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(80),
});

export const joinRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export const locationSchema = z.object({
  label: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.enum(["gps", "search", "pin"]),
});

export const preferencesSchema = z.object({
  categories: z.array(z.string().max(40)).max(20),
  cuisines: z.array(z.string().max(40)).max(20),
  budgetMin: z.number().min(0).max(100000).nullable(),
  budgetMax: z.number().min(0).max(100000).nullable(),
  budgetMandatory: z.boolean(),
  allowUnknownPrice: z.boolean(),
  categoriesMandatory: z.boolean(),
  maxDistanceKm: z.number().min(0.1).max(100).nullable(),
  travelMode: z.enum(["foot", "bike", "car"]),
  optional: z.array(z.string().max(40)).max(10),
});

export const voteSchema = z.object({
  venueId: z.string().min(1).max(128),
  value: z.enum(["yes", "no"]),
});

export const venueSnapshotSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(200),
    category: z.string().max(80),
    categories: z.array(z.string().max(80)).max(20),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .passthrough();

export const shortlistSchema = z.object({
  venueId: z.string().min(1).max(128),
  action: z.enum(["add", "remove"]),
  venue: venueSnapshotSchema.optional(),
});

export const selectVenueSchema = z.object({
  venueId: z.string().min(1).max(128),
});

export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function parseBody<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): Parsed<T> {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const issues = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Invalid input: ${issues}` };
}
