import { NextRequest } from "next/server";
import {
  createRecord,
  listRecords,
  updateRecord,
  filterValue,
} from "@/lib/db/pocketbase";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, voteSchema } from "@/lib/validation";
import { apiError, apiOk } from "@/lib/api";

/**
 * Upserts the caller's vote for a venue.
 * Unique on (room, participant), so retries and
 * double-clicks cannot create duplicate votes.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const parsed = parseBody(
      voteSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    const now = new Date().toISOString();
    const existing = await listRecords(
      "room_votes",
      `room=${filterValue(auth.room.id)} && participant=${filterValue(auth.participant.id)}`,
    );
    const payload = {
      room: auth.room.id,
      participant: auth.participant.id,
      venue_id: parsed.data.venueId,
      value: parsed.data.value,
      updated: now,
    };
    if (existing[0]) {
      await updateRecord("room_votes", existing[0].id, payload);
    } else {
      await createRecord("room_votes", payload);
    }
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to save vote",
      500,
    );
  }
}
