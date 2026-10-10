import { Bookmark, BookmarkCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { categoryLabel } from "@/lib/venues/categories";
import { formatKm } from "@/lib/utils";
import type { RankedVenue, RoomState } from "@/types";

interface VenueCardProps {
  venue: RankedVenue;
  index: number;
  state: RoomState;
  shortlisted: boolean;
  onToggleShortlist: () => void;
  onDetails: () => void;
}

export function VenueCard({
  venue,
  index,
  state,
  shortlisted,
  onToggleShortlist,
  onDetails,
}: VenueCardProps) {
  const myEstimate = venue.travel.find(
    (t) => t.participantId === state.myParticipantId,
  );

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-stone-900">
            {venue.name}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {venue.categories.map((category) => (
              <Badge key={category} variant="secondary">
                {categoryLabel(category)}
              </Badge>
            ))}
            {venue.demo && (
              <Badge variant="outline">Demo data</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-bold text-brand-700">
            {venue.score.total.toFixed(0)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-stone-400">
            match
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
        {myEstimate ? (
          <span>
            You:{" "}
            <strong className="font-semibold text-stone-800">
              {formatKm(myEstimate.distanceKm)}
            </strong>{" "}
            {myEstimate.isStraightLine && (
              <span className="text-xs text-stone-400">
                straight-line
              </span>
            )}
          </span>
        ) : (
          <span className="text-stone-400">
            Your distance unavailable
          </span>
        )}
        <span>
          {venue.price != null ? (
            <>
              About <strong className="font-semibold text-stone-800">₹{venue.price}</strong> / person
            </>
          ) : (
            <span className="text-stone-400">Price unknown</span>
          )}
        </span>
        {venue.openingHours ? (
          <span className="truncate">{venue.openingHours}</span>
        ) : (
          <span className="text-stone-400">Hours unknown</span>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Button
          size="sm"
          variant={shortlisted ? "default" : "secondary"}
          onClick={onToggleShortlist}
          aria-pressed={shortlisted}
        >
          {shortlisted ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {shortlisted ? "Shortlisted" : "Shortlist"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDetails}>
          <Info className="h-4 w-4" /> Why this rank?
        </Button>
      </div>
    </Card>
  );
}
