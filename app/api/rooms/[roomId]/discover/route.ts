import { NextRequest } from "next/server";
import {
  findRoomParticipants,
  findRoomLocations,
  findRoomPreferences,
} from "@/lib/db/repo";
import {
  getAuthenticatedParticipant,
  toPreferences,
} from "@/lib/room-state";
import {
  discoverVenues,
  type DiscoveryParticipant,
} from "@/lib/recommendations/discover";
import { apiError, apiOk } from "@/lib/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const auth = await getAuthenticatedParticipant(roomId);
    if (!auth.ok) return apiError(auth.error, auth.status);

    const [participants, locations, prefs] = await Promise.all([
      findRoomParticipants(auth.room.id),
      findRoomLocations(auth.room.id),
      findRoomPreferences(auth.room.id),
    ]);

    // Only participants with BOTH a location and preferences
    // contribute to discovery — fairness requires both.
    const discoveryParticipants: DiscoveryParticipant[] = [];
    for (const p of participants) {
      const location = locations.find((l) => l.participant_id === p.id);
      const pref = prefs.find((x) => x.participant_id === p.id);
      if (!location || !pref) continue;
      discoveryParticipants.push({
        id: p.id,
        displayName: p.display_name,
        lat: location.lat,
        lng: location.lng,
        preferences: toPreferences(pref),
      });
    }

    if (discoveryParticipants.length === 0) {
      return apiError(
        "No one has shared a location yet. Add your location and preferences first.",
        409,
      );
    }

    const result = await discoverVenues(discoveryParticipants);
    return apiOk(result);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Discovery failed",
      500,
    );
  }
}
