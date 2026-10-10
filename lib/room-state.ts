import { haversineKm } from "@/lib/providers/routing";
import {
  constantTimeEqual,
  getSession,
  hashSessionToken,
} from "@/lib/auth/session";
import { ensureCollections } from "@/lib/db/setup";
import {
  filterValue,
  listRecords,
  type PbRecord,
} from "@/lib/db/pocketbase";
import type {
  Participant,
  Room,
  RoomState,
  RoomStatus,
  Venue,
  VoteValue,
} from "@/types";

interface RoomRecord extends PbRecord {
  name: string;
  token: string;
  slug: string;
  creator_participant_id: string | null;
  expires: string;
  status: string;
  selected_venue: Venue | null;
}

export interface ParticipantRecord extends PbRecord {
  room: string;
  display_name: string;
  token_hash: string;
  is_host: boolean;
  ready: boolean;
}

interface PrivateLocationRecord extends PbRecord {
  participant: string;
  room: string;
  label: string;
  lat: number;
  lng: number;
  precision: string;
  updated: string;
}

export type { PrivateLocationRecord };

export interface PreferencesRecord extends PbRecord {
  participant: string;
  room: string;
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
  updated: string;
}

interface VoteRecord extends PbRecord {
  room: string;
  participant: string;
  venue_id: string;
  value: string;
  updated: string;
  expand?: { participant: ParticipantRecord };
}

interface ShortlistRecord extends PbRecord {
  room: string;
  venue_id: string;
  venue: Venue;
  added_by: string;
  added: string;
  expand?: { added_by: ParticipantRecord };
}

export function roomIsExpired(room: RoomRecord): boolean {
  return new Date(room.expires).getTime() <= Date.now();
}

export async function findRoomByToken(
  token: string,
): Promise<RoomRecord | null> {
  await ensureCollections();
  const rooms = await listRecords<RoomRecord>(
    "rooms",
    `token=${filterValue(token)}`,
  );
  return rooms[0] ?? null;
}

/**
 * Authenticates the current browser session against a room.
 * Compares the session token hash in constant time.
 */
export type AuthResult =
  | { ok: true; room: RoomRecord; participant: ParticipantRecord }
  | { ok: false; status: number; error: string };

export async function getAuthenticatedParticipant(
  roomToken: string,
): Promise<AuthResult> {
  const room = await findRoomByToken(roomToken);
  if (!room) {
    return {
      ok: false,
      status: 404,
      error: "Room not found. Check the invite link and try again.",
    };
  }
  if (roomIsExpired(room)) {
    return {
      ok: false,
      status: 410,
      error: "This room has expired. Create a new room to plan another hangout.",
    };
  }
  if (room.status !== "open") {
    return {
      ok: false,
      status: 410,
      error: "This room is closed.",
    };
  }

  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "You are not in this room yet. Join first.",
    };
  }
  const participants = await listRecords<ParticipantRecord>(
    "participants",
    `room=${filterValue(room.id)}`,
  );
  const me = participants.find((p) => p.id === session.participantId);
  if (!me) {
    return {
      ok: false,
      status: 401,
      error: "Your session is not part of this room.",
    };
  }
  if (!constantTimeEqual(me.token_hash, hashSessionToken(session.token))) {
    return { ok: false, status: 401, error: "Invalid session." };
  }
  return { ok: true, room, participant: me };
}

/**
 * Public room state for the current participant.
 * Private locations are never included — only
 * hasLocation flags and server-computed travel estimates.
 */
export async function getRoomState(
  roomToken: string,
): Promise<
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "ok"; state: RoomState }
> {
  const room = await findRoomByToken(roomToken);
  if (!room) return { status: "not-found" };
  if (roomIsExpired(room)) return { status: "expired" };

  const [participants, locations, prefs, shortlist, votes] =
    await Promise.all([
      listRecords<ParticipantRecord>(
        "participants",
        `room=${filterValue(room.id)}`,
      ),
      listRecords<PrivateLocationRecord>(
        "private_locations",
        `room=${filterValue(room.id)}`,
      ),
      listRecords<PreferencesRecord>(
        "preferences",
        `room=${filterValue(room.id)}`,
      ),
      listRecords<ShortlistRecord>(
        "room_shortlist",
        `room=${filterValue(room.id)}`,
        "added_by",
      ),
      listRecords<VoteRecord>(
        "room_votes",
        `room=${filterValue(room.id)}`,
        "participant",
      ),
    ]);

  const locationOwners = new Set(locations.map((l) => l.participant));
  const prefOwners = new Set(prefs.map((p) => p.participant));
  const votesByVenue = new Map<string, VoteRecord[]>();
  for (const vote of votes) {
    const list = votesByVenue.get(vote.venue_id);
    if (list) list.push(vote);
    else votesByVenue.set(vote.venue_id, [vote]);
  }

  const session = await getSession();
  let myParticipantId: string | null = null;
  let myLocation: RoomState["myLocation"] = null;
  let myPreferences: RoomState["myPreferences"] = null;
  if (session) {
    const me = participants.find(
      (p) => p.id === session.participantId,
    );
    if (
      me &&
      constantTimeEqual(me.token_hash, hashSessionToken(session.token))
    ) {
      myParticipantId = me.id;
      const mine = locations.find((l) => l.participant === me.id);
      if (mine) {
        myLocation = { label: mine.label, lat: mine.lat, lng: mine.lng };
      }
      const myPrefs = prefs.find((p) => p.participant === me.id);
      if (myPrefs) myPreferences = toPreferences(myPrefs);
    }
  }

  const roomOut: Room = {
    id: room.id,
    token: room.token,
    slug: room.slug,
    name: room.name,
    creatorParticipantId: room.creator_participant_id,
    created: room.created,
    expires: room.expires,
    status: room.status as RoomStatus,
    selectedVenue: room.selected_venue ?? null,
  };

  const participantsOut: RoomState["participants"] = participants.map(
    (p): Participant & { hasLocation: boolean; hasPreferences: boolean } => ({
      id: p.id,
      roomId: room.id,
      displayName: p.display_name,
      isHost: p.is_host,
      ready: p.ready,
      joined: p.created,
      hasLocation: locationOwners.has(p.id),
      hasPreferences: prefOwners.has(p.id),
    }),
  );

  const shortlistOut: RoomState["shortlist"] = shortlist.map((s) => ({
    roomId: room.id,
    venueId: s.venue_id,
    venue: s.venue,
    addedBy: s.added_by,
    addedByDisplayName:
      s.expand?.added_by?.display_name ?? "Unknown",
    added: s.added,
    myDistanceKm:
      myLocation != null && Number.isFinite(s.venue.lat)
        ? haversineKm(myLocation, s.venue)
        : undefined,
    votes: (votesByVenue.get(s.venue_id) ?? []).map((v) => ({
      participantId: v.participant,
      displayName: v.expand?.participant?.display_name ?? "Unknown",
      value: v.value as VoteValue,
      updated: v.updated,
    })),
  }));

  return {
    status: "ok",
    state: {
      room: roomOut,
      myParticipantId,
      myLocation,
      myPreferences,
      participants: participantsOut,
      shortlist: shortlistOut,
      totalParticipants: participants.length,
    },
  };
}

/** Maps a stored preferences record to the app model. */
export function toPreferences(
  record: PreferencesRecord,
): import("@/types").ParticipantPreferences {
  return {
    participantId: record.participant,
    categories: record.categories ?? [],
    cuisines: record.cuisines ?? [],
    budgetMin: record.budget_min ?? null,
    budgetMax: record.budget_max ?? null,
    budgetMandatory: record.budget_mandatory ?? false,
    allowUnknownPrice: record.allow_unknown_price ?? true,
    categoriesMandatory: record.categories_mandatory ?? false,
    maxDistanceKm: record.max_distance_km ?? null,
    travelMode: (record.travel_mode as "foot" | "bike" | "car") ?? "foot",
    optional: record.optional ?? [],
    updated: record.updated,
  };
}
