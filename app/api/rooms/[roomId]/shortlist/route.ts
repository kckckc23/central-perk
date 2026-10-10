import { NextRequest } from "next/server";
import {
  createRecord,
  deleteRecord,
  listRecords,
  filterValue,
} from "@/lib/db/pocketbase";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, shortlistSchema } from "@/lib/validation";
import { apiError, apiOk } from "@/lib/api";

/**
 * Adds or removes a venue from the room shortlist.
 * Unique on (room, venue_id) so duplicate adds are idempotent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const parsed = parseBody(
      shortlistSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    const existing = await listRecords(
      "room_shortlist",
      `room=${filterValue(auth.room.id)} && venue_id=${filterValue(parsed.data.venueId)}`,
    );

    if (parsed.data.action === "remove") {
      for (const record of existing) {
        await deleteRecord("room_shortlist", record.id);
      }
      return apiOk({ ok: true, action: "removed" as const });
    }

    if (existing[0]) {
      // Already shortlisted — idempotent no-op.
      return apiOk({ ok: true, action: "added" as const });
    }
    if (!parsed.data.venue) {
      return apiError("Venue details are required to shortlist.", 400);
    }

    await createRecord("room_shortlist", {
      room: auth.room.id,
      venue_id: parsed.data.venueId,
      venue: parsed.data.venue,
      added_by: auth.participant.id,
      added: new Date().toISOString(),
    });
    return apiOk({ ok: true, action: "added" as const });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to update shortlist",
      500,
    );
  }
}
