import { NextRequest } from "next/server";
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  filterValue,
} from "@/lib/db/pocketbase";
import { getAuthenticatedParticipant } from "@/lib/room-state";
import { locationSchema, parseBody } from "@/lib/validation";
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

    const now = new Date().toISOString();
    const existing = await listRecords(
      "private_locations",
      `participant=${filterValue(auth.participant.id)}`,
    );
    const payload = {
      participant: auth.participant.id,
      room: auth.room.id,
      label: parsed.data.label,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      precision: parsed.data.precision,
      updated: now,
    };
    if (existing[0]) {
      await updateRecord("private_locations", existing[0].id, payload);
    } else {
      await createRecord("private_locations", payload);
    }
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

    const existing = await listRecords(
      "private_locations",
      `participant=${filterValue(auth.participant.id)}`,
    );
    for (const record of existing) {
      await deleteRecord("private_locations", record.id);
    }
    await updateRecord("participants", auth.participant.id, {
      ready: false,
    });
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to remove location",
      500,
    );
  }
}
