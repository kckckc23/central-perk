"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  ExternalLink,
  MapPin,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import { categoryLabel } from "@/lib/venues/categories";
import { formatKm } from "@/lib/utils";
import type { RoomState, ShortlistEntry, TravelMode } from "@/types";

function directionsUrl(
  venueLat: number,
  venueLng: number,
  myLocation: { lat: number; lng: number } | null,
  mode: TravelMode,
): string {
  if (myLocation) {
    const engine =
      mode === "car"
        ? "fossgis_osrm_car"
        : mode === "bike"
          ? "fossgis_osrm_bike"
          : "fossgis_osrm_foot";
    return `https://www.openstreetmap.org/directions?engine=${engine}&route=${myLocation.lat},${myLocation.lng}~${venueLat},${venueLng}`;
  }
  return `https://www.openstreetmap.org/?mlat=${venueLat}&mlon=${venueLng}#map=16`;
}

export function VoteStep({
  state,
  onChanged,
}: {
  state: RoomState;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [voting, setVoting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const me = state.participants.find(
    (p) => p.id === state.myParticipantId,
  );
  const isHost = me?.isHost ?? false;

  async function castVote(entry: ShortlistEntry, value: "yes" | "no") {
    setVoting(entry.venueId);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/votes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId: entry.venueId, value }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save vote");
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not save vote",
        "error",
      );
    } finally {
      setVoting(null);
    }
  }

  async function confirmVenue(entry: ShortlistEntry) {
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId: entry.venueId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not confirm venue");
      toast("Venue confirmed!", "success");
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not confirm venue",
        "error",
      );
    } finally {
      setConfirming(false);
    }
  }

  if (state.room.selectedVenue) {
    const venue = state.room.selectedVenue;
    const myMode = state.myPreferences?.travelMode ?? "foot";
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Trophy className="h-6 w-6 text-emerald-700" />
        </span>
        <h2 className="text-xl font-bold text-stone-900">
          You&apos;re meeting at {venue.name}
        </h2>
        <div className="flex flex-wrap justify-center gap-1.5">
          {venue.categories.map((category) => (
            <Badge key={category} variant="secondary">
              {categoryLabel(category)}
            </Badge>
          ))}
        </div>
        {venue.address && (
          <p className="text-sm text-stone-600">{venue.address}</p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a
              href={directionsUrl(venue.lat, venue.lng, state.myLocation, myMode)}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-4 w-4" /> Get directions
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard
                .writeText(
                  `${venue.name} — ${venue.address ?? `${venue.lat}, ${venue.lng}`}`,
                )
                .then(() => toast("Venue details copied", "success"))
                .catch(() => toast("Copy failed", "error"));
            }}
          >
            Copy venue details
          </Button>
        </div>
        <p className="text-xs text-stone-500">
          Directions open in OpenStreetMap&apos;s routing UI
          ({myMode === "car" ? "driving" : myMode === "bike" ? "cycling" : "walking"}).
        </p>
      </Card>
    );
  }

  if (state.shortlist.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <BadgeCheck className="h-10 w-10 text-stone-300" />
        <h3 className="font-semibold text-stone-900">
          Nothing shortlisted yet
        </h3>
        <p className="max-w-md text-sm text-stone-600">
          Head to Discover, find a few venues the group
          likes, and shortlist them here to vote.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-1 text-base font-semibold text-stone-900">
          Shortlist &amp; vote
        </h2>
        <p className="text-sm text-stone-600">
          Vote on the shortlisted places.{" "}
          {isHost
            ? "As host, you can confirm the final venue."
            : "The host confirms the final venue."}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {state.shortlist.map((entry) => {
          const yesVotes = entry.votes.filter((v) => v.value === "yes");
          const noVotes = entry.votes.filter((v) => v.value === "no");
          const myVote = entry.votes.find(
            (v) => v.participantId === state.myParticipantId,
          );

          return (
            <Card key={entry.venueId} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-stone-900">
                    {entry.venue.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Shortlisted by {entry.addedByDisplayName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 font-semibold text-emerald-700">
                    <ThumbsUp className="h-4 w-4" />
                    {yesVotes.length}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-red-500">
                    <ThumbsDown className="h-4 w-4" />
                    {noVotes.length}
                  </span>
                </div>
              </div>

              {entry.myDistanceKm != null && (
                <p className="text-sm text-stone-600">
                  You&apos;d travel{" "}
                  <strong className="font-semibold">
                    {formatKm(entry.myDistanceKm)}
                  </strong>{" "}
                  (straight-line)
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                {yesVotes.map((vote) => (
                  <span
                    key={vote.participantId}
                    title={`${vote.displayName}: yes`}
                  >
                    <Avatar name={vote.displayName} className="h-6 w-6 text-[10px]" />
                  </span>
                ))}
                {noVotes.map((vote) => (
                  <span
                    key={vote.participantId}
                    title={`${vote.displayName}: no`}
                    className="opacity-60"
                  >
                    <Avatar name={vote.displayName} className="h-6 w-6 text-[10px]" />
                  </span>
                ))}
              </div>

              <Separator />

              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={myVote?.value === "yes" ? "default" : "secondary"}
                  disabled={voting === entry.venueId}
                  onClick={() => castVote(entry, "yes")}
                  aria-pressed={myVote?.value === "yes"}
                >
                  {myVote?.value === "yes" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ThumbsUp className="h-4 w-4" />
                  )}
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant={myVote?.value === "no" ? "danger" : "secondary"}
                  disabled={voting === entry.venueId}
                  onClick={() => castVote(entry, "no")}
                  aria-pressed={myVote?.value === "no"}
                >
                  {myVote?.value === "no" ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                  No
                </Button>
                {isHost && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    disabled={confirming}
                    onClick={() => confirmVenue(entry)}
                  >
                    <Trophy className="h-4 w-4" />
                    {confirming ? "Confirming…" : "Confirm venue"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
