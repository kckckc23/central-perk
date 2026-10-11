import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  hashSessionToken,
  newRoomToken,
  newSessionToken,
} from "@/lib/auth/session";
import { runMigrations, db } from "@/lib/db/client";
import {
  addToShortlist,
  countRoomParticipants,
  createParticipant,
  createRoom,
  deleteParticipant,
  deleteRoom,
  findLocationByParticipant,
  findRoomByToken,
  findRoomLocations,
  findRoomParticipants,
  findRoomPreferences,
  findRoomShortlist,
  findRoomVotes,
  removeFromShortlist,
  setParticipantHost,
  setRoomCreator,
  upsertLocation,
  upsertPreferences,
  upsertVote,
  type RoomRow,
} from "@/lib/db/repo";
import { roomIsExpired } from "@/lib/room-state";
import { ROOM_TTL_MS } from "@/lib/config/env";
import type { Venue } from "@/types";

/**
 * Integration tests against a real Postgres
 * (Neon, or any Postgres with the same schema).
 *
 * They run automatically when DATABASE_URL is set.
 * Point it at a scratch database, not production:
 *
 *   DATABASE_URL="postgresql://…" npm test
 *
 * "Separate browsers" are simulated by distinct
 * session tokens — exactly what each browser holds.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const createdRooms: string[] = [];

function makeVenue(id: string): Venue {
  return {
    id,
    name: `Venue ${id}`,
    category: "cafe",
    categories: ["cafe"],
    lat: 52.52 + Math.random() * 0.01,
    lng: 13.4 + Math.random() * 0.01,
    price: null,
    outdoorSeating: null,
    tags: {},
  };
}

async function makeRoom(
  hostName: string,
): Promise<{
  room: RoomRow;
  host: { id: string; token: string };
}> {
  const room = await createRoom({
    id: randomUUID(),
    token: newRoomToken(),
    slug: `room-${randomUUID().slice(0, 8)}`,
    name: "Integration test room",
    expiresAt: new Date(Date.now() + ROOM_TTL_MS),
  });
  createdRooms.push(room.id);

  const token = newSessionToken();
  const host = await createParticipant({
    id: randomUUID(),
    roomId: room.id,
    displayName: hostName,
    tokenHash: hashSessionToken(token),
    isHost: true,
  });
  await setRoomCreator(room.id, host.id);
  return { room, host: { id: host.id, token } };
}

async function joinGuest(
  roomId: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const token = newSessionToken();
  const guest = await createParticipant({
    id: randomUUID(),
    roomId,
    displayName: name,
    tokenHash: hashSessionToken(token),
    isHost: false,
  });
  return { id: guest.id, token };
}

beforeAll(async () => {
  if (hasDb) {
    // The migration process must be idempotent.
    await runMigrations();
    await runMigrations();
  }
});

afterAll(async () => {
  if (!hasDb) return;
  const sql = db();
  for (const roomId of createdRooms) {
    await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  }
  await sql.end();
});

describeDb("rooms", () => {
  it("creates rooms with unique tokens and slugs", async () => {
    const rooms = await Promise.all([
      makeRoom("Host A"),
      makeRoom("Host B"),
      makeRoom("Host C"),
    ]);
    const tokens = rooms.map((r) => r.room.token);
    const slugs = rooms.map((r) => r.room.slug);
    expect(new Set(tokens).size).toBe(3);
    expect(new Set(slugs).size).toBe(3);
    for (const { room } of rooms) {
      const found = await findRoomByToken(room.token);
      expect(found?.id).toBe(room.id);
    }
  });

  it("hosts a room and joins guests like separate browsers", async () => {
    const { room } = await makeRoom("Host");
    const g1 = await joinGuest(room.id, "Guest One");
    const g2 = await joinGuest(room.id, "Guest Two");

    const participants = await findRoomParticipants(room.id);
    expect(participants).toHaveLength(3);
    expect(participants[0].display_name).toBe("Host");
    expect(participants[0].is_host).toBe(true);
    expect(participants.map((p) => p.display_name)).toContain("Guest One");
    expect(participants.map((p) => p.display_name)).toContain("Guest Two");

    // Each session token authenticates only its own participant.
    for (const guest of [g1, g2]) {
      const me = participants.find((p) => p.id === guest.id);
      expect(me).toBeDefined();
      expect(
        constantTimeEqual(me!.token_hash, hashSessionToken(guest.token)),
      ).toBe(true);
    }
    // A token from one browser does not authenticate another participant.
    expect(
      constantTimeEqual(
        participants[0].token_hash,
        hashSessionToken(g1.token),
      ),
    ).toBe(false);
  });

  it("rejects duplicate display names within a room", async () => {
    const { room } = await makeRoom("Host");
    await joinGuest(room.id, "Taken Name");
    await expect(
      createParticipant({
        id: randomUUID(),
        roomId: room.id,
        displayName: "Taken Name",
        tokenHash: hashSessionToken(newSessionToken()),
        isHost: false,
      }),
    ).rejects.toThrow(/already in this room/i);
  });

  it("isolates rooms from each other", async () => {
    const roomA = await makeRoom("Host A");
    const roomB = await makeRoom("Host B");
    const guestB = await joinGuest(roomB.room.id, "Only In B");

    const inA = await findRoomParticipants(roomA.room.id);
    expect(inA.map((p) => p.display_name)).not.toContain("Only In B");

    const inB = await findRoomParticipants(roomB.room.id);
    expect(inB.find((p) => p.id === guestB.id)?.display_name).toBe(
      "Only In B",
    );

    // An unknown token finds nothing.
    expect(await findRoomByToken("no-such-token")).toBeNull();
  });
});

describeDb("privacy", () => {
  it("never exposes other participants' precise locations", async () => {
    const { room, host } = await makeRoom("Host");
    const guest = await joinGuest(room.id, "Guest");

    await upsertLocation({
      participantId: host.id,
      roomId: room.id,
      label: "Near host office",
      lat: 52.52,
      lng: 13.405,
      precision: "search",
      updatedAt: new Date(),
    });
    await upsertLocation({
      participantId: guest.id,
      roomId: room.id,
      label: "Near guest home",
      lat: 52.53,
      lng: 13.415,
      precision: "gps",
      updatedAt: new Date(),
    });

    // The room participant list only carries boolean flags,
    // never coordinates.
    const participants = await findRoomParticipants(room.id);
    for (const p of participants) {
      expect(p).toHaveProperty("has_location", true);
      expect(p).not.toHaveProperty("lat");
      expect(p).not.toHaveProperty("lng");
      expect(p).not.toHaveProperty("label");
    }

    // Location lookups are scoped per participant: each
    // participant can only ever load their own row.
    const hostView = await findLocationByParticipant(host.id);
    expect(hostView?.label).toBe("Near host office");
    expect(hostView?.lat).toBe(52.52);

    const guestView = await findLocationByParticipant(guest.id);
    expect(guestView?.label).toBe("Near guest home");
    expect(guestView?.lat).toBe(52.53);
  });

  it("scopes room-scoped queries to the requesting room", async () => {
    const roomA = await makeRoom("Host A");
    const roomB = await makeRoom("Host B");

    await upsertLocation({
      participantId: roomA.host.id,
      roomId: roomA.room.id,
      label: "A location",
      lat: 52.52,
      lng: 13.405,
      precision: "search",
      updatedAt: new Date(),
    });

    expect(await findRoomLocations(roomA.room.id)).toHaveLength(1);
    expect(await findRoomLocations(roomB.room.id)).toHaveLength(0);
    expect(await findRoomPreferences(roomB.room.id)).toHaveLength(0);
    expect(await findRoomVotes(roomB.room.id)).toHaveLength(0);
    expect(await findRoomShortlist(roomB.room.id)).toHaveLength(0);
  });
});

describeDb("voting", () => {
  it("is idempotent under concurrent writes", async () => {
    const { room } = await makeRoom("Host");
    const a = await joinGuest(room.id, "Voter A");
    const b = await joinGuest(room.id, "Voter B");
    const venue = makeVenue("v-1");

    // A storm of simultaneous votes from two participants
    // must collapse to exactly one row per participant.
    const storm = Array.from({ length: 50 }, () =>
      Math.random() < 0.5
        ? upsertVote({
            roomId: room.id,
            participantId: a.id,
            venueId: venue.id,
            value: "yes",
            updatedAt: new Date(),
          })
        : upsertVote({
            roomId: room.id,
            participantId: b.id,
            venueId: venue.id,
            value: "yes",
            updatedAt: new Date(),
          }),
    );
    await Promise.all(storm);

    const votes = await findRoomVotes(room.id);
    expect(votes).toHaveLength(2);
    expect(votes.every((v) => v.value === "yes")).toBe(true);
    expect(new Set(votes.map((v) => v.participant_id)).size).toBe(2);
  });

  it("moves a participant's single vote when they change venue", async () => {
    const { room } = await makeRoom("Host");
    const a = await joinGuest(room.id, "Voter A");
    const b = await joinGuest(room.id, "Voter B");

    await Promise.all([
      upsertVote({
        roomId: room.id,
        participantId: a.id,
        venueId: "v-1",
        value: "yes",
        updatedAt: new Date(),
      }),
      upsertVote({
        roomId: room.id,
        participantId: b.id,
        venueId: "v-1",
        value: "no",
        updatedAt: new Date(),
      }),
    ]);
    await upsertVote({
      roomId: room.id,
      participantId: a.id,
      venueId: "v-2",
      value: "yes",
      updatedAt: new Date(),
    });

    const v1 = (await findRoomVotes(room.id)).filter(
      (v) => v.venue_id === "v-1",
    );
    const v2 = (await findRoomVotes(room.id)).filter(
      (v) => v.venue_id === "v-2",
    );
    expect(v1).toHaveLength(1); // only B remains on v-1
    expect(v1[0].participant_id).toBe(b.id);
    expect(v2).toHaveLength(1); // A moved to v-2
    expect(v2[0].participant_id).toBe(a.id);
  });

  it("rejects invalid vote values at the database", async () => {
    const { room } = await makeRoom("Host");
    await expect(
      db()`
        INSERT INTO room_votes (room_id, participant_id, venue_id, value, updated_at)
        VALUES (${room.id}, ${randomUUID()}, 'x', 'maybe', now())
      `,
    ).rejects.toThrow();
  });
});

describeDb("shortlist", () => {
  it("is idempotent and removable", async () => {
    const { room, host } = await makeRoom("Host");
    const venue = makeVenue("s-1");

    await addToShortlist({
      roomId: room.id,
      venueId: venue.id,
      venue,
      addedBy: host.id,
      addedAt: new Date(),
    });
    await addToShortlist({
      roomId: room.id,
      venueId: venue.id,
      venue,
      addedBy: host.id,
      addedAt: new Date(),
    });

    const entries = await findRoomShortlist(room.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].venue.id).toBe(venue.id);
    expect(entries[0].added_by_name).toBe("Host");

    await removeFromShortlist(room.id, venue.id);
    expect(await findRoomShortlist(room.id)).toHaveLength(0);
  });
});

describeDb("lifecycle", () => {
  it("promotes the earliest remaining participant when the host leaves", async () => {
    const { room, host } = await makeRoom("Host");
    const g1 = await joinGuest(room.id, "First Guest");
    const g2 = await joinGuest(room.id, "Second Guest");

    await deleteParticipant(host.id);
    await setParticipantHost(g1.id, true);

    const participants = await findRoomParticipants(room.id);
    expect(participants).toHaveLength(2);
    expect(participants.find((p) => p.id === g1.id)?.is_host).toBe(true);

    // Last participant leaves → room is deleted and cascades.
    await deleteParticipant(g1.id);
    await deleteParticipant(g2.id);
    await deleteRoom(room.id);
    expect(await findRoomByToken(room.token)).toBeNull();
    expect(await countRoomParticipants(room.id)).toBe(0);
    expect(await findRoomLocations(room.id)).toHaveLength(0);
  });

  it("detects expired rooms", async () => {
    const room = await createRoom({
      id: randomUUID(),
      token: newRoomToken(),
      slug: `expired-${randomUUID().slice(0, 8)}`,
      name: "Expired room",
      expiresAt: new Date(Date.now() - 1000),
    });
    createdRooms.push(room.id);
    expect(roomIsExpired(room)).toBe(true);
  });

  it("stores and updates preferences idempotently", async () => {
    const { room, host } = await makeRoom("Host");

    const write = () =>
      upsertPreferences({
        participantId: host.id,
        roomId: room.id,
        categories: ["cafe"],
        cuisines: ["italian"],
        budgetMin: 5,
        budgetMax: 20,
        budgetMandatory: false,
        allowUnknownPrice: true,
        categoriesMandatory: false,
        maxDistanceKm: 2,
        travelMode: "foot",
        optional: ["outdoor"],
        updatedAt: new Date(),
      });
    await Promise.all([write(), write(), write()]);

    const prefs = await findRoomPreferences(room.id);
    expect(prefs).toHaveLength(1);
    expect(prefs[0].categories).toEqual(["cafe"]);
    expect(prefs[0].travel_mode).toBe("foot");
    expect(prefs[0].max_distance_km).toBe(2);
  });
});
