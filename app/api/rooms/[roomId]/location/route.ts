import { NextRequest } from "next/server";
import {
  deleteLocation,
  upsertLocation,
} from "@/lib/db/repo";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { locationSchema, parseBody } from "@/lib/validation";
import { setParticipantReady } from "@/lib/db/repo";
import { apiError, apiOk } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const parsed = parseBody(
      locationSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    await upsertLocation({
      participantId: auth.participant.id,
      roomId: auth.room.id,
      label: parsed.data.label,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      precision: parsed.data.precision,
      updatedAt: new Date(),
    });
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to save location",
      500,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    await deleteLocation(auth.participant.id);
    await setParticipantReady(auth.participant.id, false);
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to remove location",
      500,
    );
  }
}
