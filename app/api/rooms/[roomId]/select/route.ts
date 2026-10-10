import { NextRequest } from "next/server";
import {
  listRecords,
  updateRecord,
  filterValue,
} from "@/lib/db/pocketbase";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, selectVenueSchema } from "@/lib/validation";
import { apiError, apiOk } from "@/lib/api";

/**
 * Host confirms the final meetup venue.
 * Only shortlisted venues can be selected.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    if (!auth.participant.is_host) {
      return apiError(
        "Only the room host can confirm the final venue.",
        403,
      );
    }

    const parsed = parseBody(
      selectVenueSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    const shortlisted = await listRecords(
      "room_shortlist",
      `room=${filterValue(auth.room.id)} && venue_id=${filterValue(parsed.data.venueId)}`,
    );
    if (shortlisted.length === 0) {
      return apiError(
        "Only shortlisted venues can be confirmed.",
        404,
      );
    }

    await updateRecord("rooms", auth.room.id, {
      selected_venue: shortlisted[0].venue,
    });
    return apiOk({ ok: true, venue: shortlisted[0].venue });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to confirm venue",
      500,
    );
  }
}
