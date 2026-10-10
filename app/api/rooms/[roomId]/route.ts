import { NextRequest } from "next/server";
import { getRoomState } from "@/lib/room-state";
import { apiError, apiOk } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const result = await getRoomState(roomId);
    if (result.status === "not-found") {
      return apiError("Room not found.", 404);
    }
    if (result.status === "expired") {
      return apiError("This room has expired.", 410);
    }
    return apiOk(result.state);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to load room",
      500,
    );
  }
}
