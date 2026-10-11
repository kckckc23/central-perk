import { haversineKm } from "@/lib/providers/routing";
import {
  constantTimeEqual,
  getSession,
  hashSessionToken,
} from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";
import {
  findLocationByParticipant,
  findParticipantById,
  findPreferencesByParticipant,
  findRoomByToken,
  findRoomParticipants,
  findRoomShortlist,
  findRoomVotes,
  findShortlistEntry,
  setRoomSelectedVenue,
  type LocationRow,
  type ParticipantRow,
  type PreferencesRow,
  type RoomRow,
} from "@/lib/db/repo";
import type {
  Participant,
  ParticipantPreferences,
  Room,
  RoomState,
  RoomStatus,
  Venue,
  VoteValue,
} from "@/types";

export type { RoomRow, ParticipantRow, PreferencesRow, LocationRow };

export function roomIsExpired(room: RoomRow): boolean {
  return room.expires_at.getTime() <= Date.now();
}

/**
 * Authenticates the current browser session against
 * a room. The session token is only ever compared
 * as a SHA-256 hash, in constant time.
 */
export type AuthResult =
  | { ok: true; room: RoomRow; participant: ParticipantRow }
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
    return { ok: false, status: 410, error: "This room is closed." };
  }

  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "You are not in this room yet. Join first.",
    };
  }
  const me = await findParticipantById(session.participantId);
  if (!me || me.room_id !== room.id) {
    return { ok: false, status: 401, error: "Your session is not part of this room." };
  }
  if (!constantTimeEqual(me.token_hash, hashSessionToken(session.token))) {
    return { ok: false, status: 401, error: "Invalid session." };
  }
  return { ok: true, room, participant: me };
}

/**
 * Public room state for the current participant.
 * Private locations are never included — only
 * hasLocation flags, and the caller's own
 * location. Travel estimates are computed
 * server-side and returned by the discovery
 * endpoint, never raw coordinates.
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

  const [participants, shortlist, votes, session] = await Promise.all([
    findRoomParticipants(room.id),
    findRoomShortlist(room.id),
    findRoomVotes(room.id),
    getSession(),
  ]);

  const votesByVenue = new Map<string, typeof votes>();
  for (const vote of votes) {
    const list = votesByVenue.get(vote.venue_id);
    if (list) list.push(vote);
    else votesByVenue.set(vote.venue_id, [vote]);
  }

  // Identify the caller and load only THEIR
  // private location and preferences.
  let myParticipantId: string | null = null;
  let myLocation: RoomState["myLocation"] = null;
  let myPreferences: RoomState["myPreferences"] = null;
  if (session) {
    const me = participants.find((p) => p.id === session.participantId);
    if (
      me &&
      constantTimeEqual(me.token_hash, hashSessionToken(session.token))
    ) {
      myParticipantId = me.id;
      const mine = await findLocationByParticipant(me.id);
      if (mine) {
        myLocation = { label: mine.label, lat: mine.lat, lng: mine.lng };
      }
      const myPrefs = await findPreferencesByParticipant(me.id);
      if (myPrefs) myPreferences = toPreferences(myPrefs);
    }
  }

  const roomOut: Room = {
    id: room.id,
    token: room.token,
    slug: room.slug,
    name: room.name,
    creatorParticipantId: room.creator_participant_id,
    created: room.created_at.toISOString(),
    expires: room.expires_at.toISOString(),
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
      joined: p.joined_at.toISOString(),
      hasLocation: p.has_location,
      hasPreferences: p.has_preferences,
    }),
  );

  const shortlistOut: RoomState["shortlist"] = shortlist.map((s) => ({
    roomId: room.id,
    venueId: s.venue_id,
    venue: s.venue,
    addedBy: s.added_by,
    addedByDisplayName: s.added_by_name,
    added: s.added_at.toISOString(),
    myDistanceKm:
      myLocation != null && Number.isFinite(s.venue.lat)
        ? haversineKm(myLocation, s.venue)
        : undefined,
    votes: (votesByVenue.get(s.venue_id) ?? []).map((v) => ({
      participantId: v.participant_id,
      displayName: v.display_name ?? "Unknown",
      value: v.value as VoteValue,
      updated: v.updated_at.toISOString(),
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

/** Maps a stored preferences row to the app model. */
export function toPreferences(
  record: PreferencesRow,
): ParticipantPreferences {
  return {
    participantId: record.participant_id,
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
    updated: record.updated_at.toISOString(),
  };
}

/** Used by the select-venue flow: only shortlisted venues can be confirmed. */
export async function getShortlistEntry(
  roomId: string,
  venueId: string,
) {
  return findShortlistEntry(roomId, venueId);
}

export async function confirmRoomVenue(
  roomId: string,
  venue: Venue,
): Promise<void> {
  await setRoomSelectedVenue(roomId, venue);
}

export { DatabaseError };
