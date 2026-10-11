/**
 * Explicit database schema, as versioned migrations.
 *
 * Pure data module with no imports so it can be
 * executed both by Next.js (server boot, auto-migrate)
 * and by `npm run db:migrate` (plain Node).
 *
 * Design notes:
 * - Every table is keyed by unguessable text ids
 *   (crypto.randomUUID), never auto-increment ints.
 * - `rooms.creator_participant_id` is deliberately
 *   a plain text column: a foreign key to
 *   participants would be circular (rooms ←→
 *   participants) and complicates host transfer.
 *   The application enforces it.
 * - Unique constraints enforce the invariants the
 *   API relies on: one vote per participant, one
 *   shortlist entry per room/venue, one location
 *   and one preferences row per participant, and
 *   unique display names within a room.
 * - ON DELETE CASCADE keeps rooms, participants,
 *   locations, preferences, votes and shortlist
 *   entries consistent when a participant leaves
 *   or a room is deleted.
 */

export interface Migration {
  name: string;
  statements: string[];
}

export const migrations: Migration[] = [
  {
    name: "0001_initial_schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        creator_participant_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        selected_venue JSONB
      )`,

      `CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        is_host BOOLEAN NOT NULL DEFAULT false,
        ready BOOLEAN NOT NULL DEFAULT false,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (room_id, display_name)
      )`,

      `CREATE TABLE IF NOT EXISTS private_locations (
        participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        precision TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS preferences (
        participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        categories JSONB NOT NULL DEFAULT '[]',
        cuisines JSONB NOT NULL DEFAULT '[]',
        budget_min DOUBLE PRECISION,
        budget_max DOUBLE PRECISION,
        budget_mandatory BOOLEAN NOT NULL DEFAULT false,
        allow_unknown_price BOOLEAN NOT NULL DEFAULT true,
        categories_mandatory BOOLEAN NOT NULL DEFAULT false,
        max_distance_km DOUBLE PRECISION,
        travel_mode TEXT NOT NULL DEFAULT 'foot',
        optional JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS room_votes (
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        venue_id TEXT NOT NULL,
        value TEXT NOT NULL CHECK (value IN ('yes', 'no')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (room_id, participant_id)
      )`,

      `CREATE TABLE IF NOT EXISTS room_shortlist (
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        venue_id TEXT NOT NULL,
        venue JSONB NOT NULL,
        added_by TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (room_id, venue_id)
      )`,

      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      `CREATE INDEX IF NOT EXISTS idx_participants_room ON participants (room_id)`,
      `CREATE INDEX IF NOT EXISTS idx_private_locations_room ON private_locations (room_id)`,
      `CREATE INDEX IF NOT EXISTS idx_preferences_room ON preferences (room_id)`,
      `CREATE INDEX IF NOT EXISTS idx_room_votes_room ON room_votes (room_id)`,
      `CREATE INDEX IF NOT EXISTS idx_room_shortlist_room ON room_shortlist (room_id)`,
    ],
  },
];
