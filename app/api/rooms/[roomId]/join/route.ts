import { NextRequest } from "next/server";
import {
  createRecord,
  listRecords,
  filterValue,
} from "@/lib/db/pocketbase";
import { ensureCollections } from "@/lib/db/setup";
import {
  hashSessionToken,
  newSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { joinRoomSchema, parseBody } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import {
  findRoomByToken,
  roomIsExpired,
} from "@/lib/room-state";
import { apiError, apiOk } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown";
    if (!rateLimit(`join:${clientIp}`, 20, 60_000)) {
      return apiError("Too many join attempts. Try again shortly.", 429);
    }

    const parsed = parseBody(
      joinRoomSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    await ensureCollections();
    const room = await findRoomByToken(roomId);
    if (!room) return apiError("Room not found. Check the invite link.", 404);
    if (roomIsExpired(room)) {
      return apiError(
        "This room has expired. Ask the host to create a new one.",
        410,
      );
    }
    if (room.status !== "open") {
      return apiError("This room is closed.", 410);
    }

    const existing = await listRecords(
      "participants",
      `room=${filterValue(room.id)} && display_name=${filterValue(parsed.data.displayName)}`,
    );
    if (existing.length > 0) {
      return apiError(
        "That display name is already in this room. Pick another so people can tell you apart.",
        409,
      );
    }

    const sessionToken = newSessionToken();
    const participant = await createRecord("participants", {
      room: room.id,
      display_name: parsed.data.displayName,
      token_hash: hashSessionToken(sessionToken),
      is_host: false,
      ready: false,
    });

    await setSessionCookie(participant.id, sessionToken);

    return apiOk({
      participant: {
        id: participant.id,
        displayName: participant.display_name,
        isHost: false,
      },
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to join room",
      500,
    );
  }
}
