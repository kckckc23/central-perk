import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  createParticipant,
  createRoom,
  setRoomCreator,
} from "@/lib/db/repo";
import { isUniqueViolation } from "@/lib/db/client";
import { ROOM_TTL_MS } from "@/lib/config/env";
import {
  hashSessionToken,
  newRoomToken,
  newSessionToken,
  newSlugSuffix,
  setSessionCookie,
} from "@/lib/auth/session";
import { createRoomSchema, parseBody } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { apiError, apiOk } from "@/lib/api";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "room";
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`create-room:${clientIp(request)}`, 10, 60_000)) {
      return apiError(
        "Too many requests. Please wait a moment and try again.",
        429,
      );
    }

    const parsed = parseBody(
      createRoomSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    const expiresAt = new Date(Date.now() + ROOM_TTL_MS);

    // Unique token + slug, retried on the rare
    // collision (the database enforces uniqueness).
    let room;
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = newRoomToken();
      const slug = `${slugify(parsed.data.name)}-${newSlugSuffix()}`;
      try {
        room = await createRoom({
          id: randomUUID(),
          token,
          slug,
          name: parsed.data.name,
          expiresAt,
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 4) continue;
        throw err;
      }
    }
    if (!room!) return apiError("Could not create room.", 500);

    const sessionToken = newSessionToken();
    const participant = await createParticipant({
      id: randomUUID(),
      roomId: room.id,
      displayName: parsed.data.displayName,
      tokenHash: hashSessionToken(sessionToken),
      isHost: true,
    });

    await setRoomCreator(room.id, participant.id);
    await setSessionCookie(participant.id, sessionToken);

    return apiOk(
      {
        room: {
          id: room.id,
          token: room.token,
          slug: room.slug,
          name: room.name,
          expires: room.expires_at.toISOString(),
        },
        participant: {
          id: participant.id,
          displayName: participant.display_name,
          isHost: true,
        },
      },
      201,
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to create room",
      500,
    );
  }
}
