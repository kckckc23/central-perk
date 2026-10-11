import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  createParticipant,
  findRoomByToken,
} from "@/lib/db/repo";
import { roomIsExpired } from "@/lib/room-state";
import {
  hashSessionToken,
  newSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { joinRoomSchema, parseBody } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
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

    const sessionToken = newSessionToken();
    const participant = await createParticipant({
      id: randomUUID(),
      roomId: room.id,
      displayName: parsed.data.displayName,
      tokenHash: hashSessionToken(sessionToken),
      isHost: false,
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
    // createParticipant throws a friendly
    // DatabaseError on a duplicate display name.
    return apiError(
      err instanceof Error ? err.message : "Failed to join room",
      err instanceof Error && err.name === "DatabaseError" ? 409 : 500,
    );
  }
}
