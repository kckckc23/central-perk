import { NextRequest } from "next/server";
import {
  countRoomParticipants,
  deleteParticipant,
  deleteRoom,
  findRoomParticipants,
  setParticipantHost,
} from "@/lib/db/repo";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { apiError, apiOk } from "@/lib/api";

/**
 * Leaves the room. Cascading deletes remove the
 * caller's location, preferences, votes and any
 * shortlist entries they added. If the host
 * leaves, the earliest remaining participant is
 * promoted; if nobody remains, the room is deleted.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const remaining = await findRoomParticipants(auth.room.id);
    const others = remaining
      .filter((p) => p.id !== auth.participant.id)
      .sort((a, b) => a.joined_at.getTime() - b.joined_at.getTime());

    await deleteParticipant(auth.participant.id);

    if (others.length === 0) {
      await deleteRoom(auth.room.id);
      return apiOk({ ok: true, roomDeleted: true });
    }

    if (auth.participant.is_host) {
      await setParticipantHost(others[0].id, true);
      return apiOk({ ok: true, newHost: others[0].display_name });
    }
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to leave room",
      500,
    );
  }
}
