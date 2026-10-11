import { NextRequest } from "next/server";
import {
  addToShortlist,
  removeFromShortlist,
} from "@/lib/db/repo";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, shortlistSchema } from "@/lib/validation";
import { apiError, apiOk } from "@/lib/api";

/** Idempotent: re-adding a shortlisted venue is a no-op. */
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

    if (parsed.data.action === "remove") {
      await removeFromShortlist(auth.room.id, parsed.data.venueId);
      return apiOk({ ok: true, action: "removed" as const });
    }

    if (!parsed.data.venue) {
      return apiError("Venue details are required to shortlist.", 400);
    }

    await addToShortlist({
      roomId: auth.room.id,
      venueId: parsed.data.venueId,
      venue: parsed.data.venue,
      addedBy: auth.participant.id,
      addedAt: new Date(),
    });
    return apiOk({ ok: true, action: "added" as const });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to update shortlist",
      500,
    );
  }
}
