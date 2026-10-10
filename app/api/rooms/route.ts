import type { NextRequest } from "next/server";
import {
  createRecord,
  PocketBaseError,
  updateRecord,
} from "@/lib/db/pocketbase";
import { ensureCollections } from "@/lib/db/setup";
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

async function createRoomWithUniqueToken(
  name: string,
  expires: string,
): Promise<ReturnType<typeof createRecord>> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = newRoomToken();
    const slug = `${slugify(name)}-${newSlugSuffix()}`;
    try {
      return await createRecord("rooms", {
        name,
        token,
        slug,
        creator_participant_id: null,
        expires,
        status: "open",
        selected_venue: null,
      });
    } catch (err) {
      lastError = err;
      // Unique-constraint collision → retry with a fresh token/slug.
      if (err instanceof PocketBaseError && err.status === 400) continue;
      throw err;
    }
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    if (
      !rateLimit(`create-room:${clientIp(request)}`, 10, 60_000)
    ) {
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

    await ensureCollections();

    const room = await createRoomWithUniqueToken(
      parsed.data.name,
      new Date(Date.now() + ROOM_TTL_MS).toISOString(),
    );

    const sessionToken = newSessionToken();
    const participant = await createRecord("participants", {
      room: room.id,
      display_name: parsed.data.displayName,
      token_hash: hashSessionToken(sessionToken),
      is_host: true,
      ready: false,
    });

    await updateRecord("rooms", room.id, {
      creator_participant_id: participant.id,
    });

    await setSessionCookie(participant.id, sessionToken);

    return apiOk(
      {
        room: {
          id: room.id,
          token: room.token,
          slug: room.slug,
          name: room.name,
          expires: room.expires,
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
