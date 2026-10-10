import { NextRequest } from "next/server";
import {
  createRecord,
  listRecords,
  updateRecord,
  filterValue,
} from "@/lib/db/pocketbase";
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

    const now = new Date().toISOString();
    const payload = {
      participant: auth.participant.id,
      room: auth.room.id,
      categories: parsed.data.categories,
      cuisines: parsed.data.cuisines,
      budget_min: parsed.data.budgetMin,
      budget_max: parsed.data.budgetMax,
      budget_mandatory: parsed.data.budgetMandatory,
      allow_unknown_price: parsed.data.allowUnknownPrice,
      categories_mandatory: parsed.data.categoriesMandatory,
      max_distance_km: parsed.data.maxDistanceKm,
      travel_mode: parsed.data.travelMode,
      optional: parsed.data.optional,
      updated: now,
    };
    const existing = await listRecords(
      "preferences",
      `participant=${filterValue(auth.participant.id)}`,
    );
    if (existing[0]) {
      await updateRecord("preferences", existing[0].id, payload);
    } else {
      await createRecord("preferences", payload);
    }
    await updateRecord("participants", auth.participant.id, {
      ready: true,
    });
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to save preferences",
      500,
    );
  }
}
