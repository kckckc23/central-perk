import { NextRequest } from "next/server";
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  filterValue,
} from "@/lib/db/pocketbase";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { apiError, apiOk } from "@/lib/api";
import type { ParticipantRecord } from "@/lib/room-state";

/**
 * Leaves the room. Cascade deletes clean up the caller's
 * location, preferences and votes. If the host leaves,
 * the earliest remaining participant is promoted; if nobody
 * remains, the room is deleted.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const remaining = (
      await listRecords<ParticipantRecord>(
        "participants",
        `room=${filterValue(auth.room.id)} && id!=${filterValue(auth.participant.id)}`,
      )
    ).sort((a, b) => a.created.localeCompare(b.created));

    await deleteRecord("participants", auth.participant.id);

    if (remaining.length === 0) {
      await deleteRecord("rooms", auth.room.id);
      return apiOk({ ok: true, roomDeleted: true });
    }

    if (auth.participant.is_host) {
      await updateRecord("participants", remaining[0].id, {
        is_host: true,
      });
      return apiOk({ ok: true, newHost: remaining[0].display_name });
    }
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to leave room",
      500,
    );
  }
}
