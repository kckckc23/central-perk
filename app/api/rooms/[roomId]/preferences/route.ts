import { NextRequest } from "next/server";
import {
  setParticipantReady,
  upsertPreferences,
} from "@/lib/db/repo";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { parseBody, preferencesSchema } from "@/lib/validation";
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
      preferencesSchema,
      await request.json().catch(() => null),
    );
    if (!parsed.ok) return apiError(parsed.error, 400);

    await upsertPreferences({
      participantId: auth.participant.id,
      roomId: auth.room.id,
      categories: parsed.data.categories,
      cuisines: parsed.data.cuisines,
      budgetMin: parsed.data.budgetMin,
      budgetMax: parsed.data.budgetMax,
      budgetMandatory: parsed.data.budgetMandatory,
      allowUnknownPrice: parsed.data.allowUnknownPrice,
      categoriesMandatory: parsed.data.categoriesMandatory,
      maxDistanceKm: parsed.data.maxDistanceKm,
      travelMode: parsed.data.travelMode,
      optional: parsed.data.optional,
      updatedAt: new Date(),
    });
    await setParticipantReady(auth.participant.id, true);
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to save preferences",
      500,
    );
  }
}
