import { db, isUniqueViolation, DatabaseError } from "@/lib/db/client";
import type {
  LocationPrecision,
  TravelMode,
  Venue,
  VoteValue,
} from "@/types";

/**
 * Postgres repository layer — the only module
 * that talks to the database. Every query is
 * parameterised through postgres.js templates,
 * and every room-scoped query filters by
 * room_id, so room isolation is enforced in
 * the database, not the UI.
 */

export interface RoomRow {
  id: string;
  token: string;
  slug: string;
  name: string;
  creator_participant_id: string | null;
  created_at: Date;
  expires_at: Date;
  status: string;
  selected_venue: Venue | null;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  display_name: string;
  token_hash: string;
  is_host: boolean;
  ready: boolean;
  joined_at: Date;
}

export interface ParticipantWithFlagsRow extends ParticipantRow {
  has_location: boolean;
  has_preferences: boolean;
}

export interface LocationRow {
  participant_id: string;
  room_id: string;
  label: string;
  lat: number;
  lng: number;
  precision: string;
  updated_at: Date;
}

export interface PreferencesRow {
  participant_id: string;
  room_id: string;
  categories: string[];
  cuisines: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_mandatory: boolean;
  allow_unknown_price: boolean;
  categories_mandatory: boolean;
  max_distance_km: number | null;
  travel_mode: string;
  optional: string[];
  updated_at: Date;
}

export interface VoteRow {
  room_id: string;
  participant_id: string;
  venue_id: string;
  value: string;
  updated_at: Date;
  display_name?: string;
}

export interface ShortlistRow {
  room_id: string;
  venue_id: string;
  venue: Venue;
  added_by: string;
  added_at: Date;
  added_by_name: string;
}

/**
 * postgres.js serialises plain objects to
 * jsonb at runtime; its published parameter
 * types omit objects, so cast through here.
 */
const jsonbParam = (value: Venue): string =>
  value as unknown as string;

// ---------------------------------------------------------------- rooms

export async function createRoom(input: {
  id: string;
  token: string;
  slug: string;
  name: string;
  expiresAt: Date;
}): Promise<RoomRow> {
  const sql = db();
  const rows = await sql<RoomRow[]>`
    INSERT INTO rooms (id, token, slug, name, expires_at, status)
    VALUES (${input.id}, ${input.token}, ${input.slug}, ${input.name}, ${input.expiresAt}, 'open')
    RETURNING *
  `;
  return rows[0];
}

export async function findRoomByToken(token: string): Promise<RoomRow | null> {
  const sql = db();
  const rows = await sql<RoomRow[]>`
    SELECT * FROM rooms WHERE token = ${token}
  `;
  return rows[0] ?? null;
}

export async function setRoomCreator(
  roomId: string,
  participantId: string,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE rooms SET creator_participant_id = ${participantId} WHERE id = ${roomId}
  `;
}

export async function setRoomSelectedVenue(
  roomId: string,
  venue: Venue,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE rooms SET selected_venue = ${jsonbParam(venue)} WHERE id = ${roomId}
  `;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM rooms WHERE id = ${roomId}`;
}

// ---------------------------------------------------------- participants

export async function createParticipant(input: {
  id: string;
  roomId: string;
  displayName: string;
  tokenHash: string;
  isHost: boolean;
}): Promise<ParticipantRow> {
  const sql = db();
  try {
    const rows = await sql<ParticipantRow[]>`
      INSERT INTO participants (id, room_id, display_name, token_hash, is_host, ready)
      VALUES (${input.id}, ${input.roomId}, ${input.displayName}, ${input.tokenHash}, ${input.isHost}, false)
      RETURNING *
    `;
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Either the display name is taken in this room
      // (UNIQUE room_id, display_name) or the token
      // hash collided (practically impossible).
      throw new DatabaseError(
        "That display name is already in this room. Pick another so people can tell you apart.",
      );
    }
    throw err;
  }
}

export async function findRoomParticipants(
  roomId: string,
): Promise<ParticipantWithFlagsRow[]> {
  const sql = db();
  return sql<ParticipantWithFlagsRow[]>`
    SELECT p.*,
      (l.participant_id IS NOT NULL) AS has_location,
      (pr.participant_id IS NOT NULL) AS has_preferences
    FROM participants p
    LEFT JOIN private_locations l ON l.participant_id = p.id
    LEFT JOIN preferences pr ON pr.participant_id = p.id
    WHERE p.room_id = ${roomId}
    ORDER BY p.joined_at ASC
  `;
}

export async function findParticipantById(
  id: string,
): Promise<ParticipantRow | null> {
  const sql = db();
  const rows = await sql<ParticipantRow[]>`
    SELECT * FROM participants WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function countRoomParticipants(roomId: string): Promise<number> {
  const sql = db();
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM participants WHERE room_id = ${roomId}
  `;
  return rows[0].count;
}

export async function setParticipantReady(
  id: string,
  ready: boolean,
): Promise<void> {
  const sql = db();
  await sql`UPDATE participants SET ready = ${ready} WHERE id = ${id}`;
}

export async function setParticipantHost(
  id: string,
  isHost: boolean,
): Promise<void> {
  const sql = db();
  await sql`UPDATE participants SET is_host = ${isHost} WHERE id = ${id}`;
}

export async function deleteParticipant(id: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM participants WHERE id = ${id}`;
}

// ----------------------------------------------------- private locations

export async function upsertLocation(input: {
  participantId: string;
  roomId: string;
  label: string;
  lat: number;
  lng: number;
  precision: LocationPrecision;
  updatedAt: Date;
}): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO private_locations
      (participant_id, room_id, label, lat, lng, precision, updated_at)
    VALUES
      (${input.participantId}, ${input.roomId}, ${input.label}, ${input.lat}, ${input.lng}, ${input.precision}, ${input.updatedAt})
    ON CONFLICT (participant_id)
    DO UPDATE SET
      label = EXCLUDED.label,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      precision = EXCLUDED.precision,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function findLocationByParticipant(
  participantId: string,
): Promise<LocationRow | null> {
  const sql = db();
  const rows = await sql<LocationRow[]>`
    SELECT * FROM private_locations WHERE participant_id = ${participantId}
  `;
  return rows[0] ?? null;
}

export async function findRoomLocations(
  roomId: string,
): Promise<LocationRow[]> {
  const sql = db();
  return sql<LocationRow[]>`SELECT * FROM private_locations WHERE room_id = ${roomId}`;
}

export async function deleteLocation(participantId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM private_locations WHERE participant_id = ${participantId}`;
}

// ----------------------------------------------------------- preferences

export async function upsertPreferences(input: {
  participantId: string;
  roomId: string;
  categories: string[];
  cuisines: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  budgetMandatory: boolean;
  allowUnknownPrice: boolean;
  categoriesMandatory: boolean;
  maxDistanceKm: number | null;
  travelMode: TravelMode;
  optional: string[];
  updatedAt: Date;
}): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO preferences
      (participant_id, room_id, categories, cuisines, budget_min, budget_max,
       budget_mandatory, allow_unknown_price, categories_mandatory,
       max_distance_km, travel_mode, optional, updated_at)
    VALUES
      (${input.participantId}, ${input.roomId}, ${input.categories}, ${input.cuisines},
       ${input.budgetMin}, ${input.budgetMax}, ${input.budgetMandatory},
       ${input.allowUnknownPrice}, ${input.categoriesMandatory}, ${input.maxDistanceKm},
       ${input.travelMode}, ${input.optional}, ${input.updatedAt})
    ON CONFLICT (participant_id)
    DO UPDATE SET
      categories = EXCLUDED.categories,
      cuisines = EXCLUDED.cuisines,
      budget_min = EXCLUDED.budget_min,
      budget_max = EXCLUDED.budget_max,
      budget_mandatory = EXCLUDED.budget_mandatory,
      allow_unknown_price = EXCLUDED.allow_unknown_price,
      categories_mandatory = EXCLUDED.categories_mandatory,
      max_distance_km = EXCLUDED.max_distance_km,
      travel_mode = EXCLUDED.travel_mode,
      optional = EXCLUDED.optional,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function findPreferencesByParticipant(
  participantId: string,
): Promise<PreferencesRow | null> {
  const sql = db();
  const rows = await sql<PreferencesRow[]>`
    SELECT * FROM preferences WHERE participant_id = ${participantId}
  `;
  return rows[0] ?? null;
}

export async function findRoomPreferences(
  roomId: string,
): Promise<PreferencesRow[]> {
  const sql = db();
  return sql<PreferencesRow[]>`SELECT * FROM preferences WHERE room_id = ${roomId}`;
}

// ----------------------------------------------------------------- votes

/**
 * Atomic upsert: the primary key (room_id, participant_id)
 * makes one vote per participant, so concurrent or
 * retried clicks can never create duplicate votes.
 */
export async function upsertVote(input: {
  roomId: string;
  participantId: string;
  venueId: string;
  value: VoteValue;
  updatedAt: Date;
}): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO room_votes (room_id, participant_id, venue_id, value, updated_at)
    VALUES (${input.roomId}, ${input.participantId}, ${input.venueId}, ${input.value}, ${input.updatedAt})
    ON CONFLICT (room_id, participant_id)
    DO UPDATE SET
      venue_id = EXCLUDED.venue_id,
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function findRoomVotes(roomId: string): Promise<VoteRow[]> {
  const sql = db();
  return sql<VoteRow[]>`
    SELECT v.*, p.display_name
    FROM room_votes v
    JOIN participants p ON p.id = v.participant_id
    WHERE v.room_id = ${roomId}
  `;
}

// -------------------------------------------------------------- shortlist

/** Idempotent: re-adding the same venue is a no-op. */
export async function addToShortlist(input: {
  roomId: string;
  venueId: string;
  venue: Venue;
  addedBy: string;
  addedAt: Date;
}): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO room_shortlist (room_id, venue_id, venue, added_by, added_at)
    VALUES (${input.roomId}, ${input.venueId}, ${jsonbParam(input.venue)}, ${input.addedBy}, ${input.addedAt})
    ON CONFLICT (room_id, venue_id) DO NOTHING
  `;
}

export async function removeFromShortlist(
  roomId: string,
  venueId: string,
): Promise<void> {
  const sql = db();
  await sql`
    DELETE FROM room_shortlist WHERE room_id = ${roomId} AND venue_id = ${venueId}
  `;
}

export async function findRoomShortlist(
  roomId: string,
): Promise<ShortlistRow[]> {
  const sql = db();
  return sql<ShortlistRow[]>`
    SELECT s.*, p.display_name AS added_by_name
    FROM room_shortlist s
    JOIN participants p ON p.id = s.added_by
    WHERE s.room_id = ${roomId}
    ORDER BY s.added_at ASC
  `;
}

export async function findShortlistEntry(
  roomId: string,
  venueId: string,
): Promise<ShortlistRow | null> {
  const sql = db();
  const rows = await sql<ShortlistRow[]>`
    SELECT s.*, p.display_name AS added_by_name
    FROM room_shortlist s
    JOIN participants p ON p.id = s.added_by
    WHERE s.room_id = ${roomId} AND s.venue_id = ${venueId}
  `;
  return rows[0] ?? null;
}
