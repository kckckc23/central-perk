import { NextRequest } from "next/server";
import { upsertVote } from "@/lib/db/repo";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, voteSchema } from "@/lib/validation";
import { apiError, apiOk } from "@/lib/api";

/**
 * Atomic upsert on the (room_id, participant_id)
 * primary key — concurrent or retried clicks
 * can never create duplicate votes.
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

    await upsertVote({
      roomId: auth.room.id,
      participantId: auth.participant.id,
      venueId: parsed.data.venueId,
      value: parsed.data.value,
      updatedAt: new Date(),
    });
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to save vote",
      500,
    );
  }
}
