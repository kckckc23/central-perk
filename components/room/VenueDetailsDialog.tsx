"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { categoryLabel, cuisineLabel } from "@/lib/venues/categories";
import { formatKm, formatMinutes } from "@/lib/utils";
import type { RankedVenue } from "@/types";

interface VenueDetailsDialogProps {
  venue: RankedVenue | null;
  onClose: () => void;
}

export function VenueDetailsDialog({
  venue,
  onClose,
}: VenueDetailsDialogProps) {
  return (
    <Dialog open={venue !== null} onOpenChange={(open) => !open && onClose()}>
      {venue && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{venue.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {venue.categories.map((category) => (
              <Badge key={category} variant="secondary">
                {categoryLabel(category)}
              </Badge>
            ))}
            {venue.demo && <Badge variant="outline">Demo data</Badge>}
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-stone-800">
              Why it ranks well
            </h3>
            <div className="flex flex-col gap-1.5">
              <ScoreBar label="Travel fairness" value={venue.score.travel} />
              <ScoreBar label="Preference match" value={venue.score.preference} />
              <ScoreBar label="Data completeness" value={venue.score.completeness} />
            </div>
            <ul className="list-disc pl-5 text-sm text-stone-600">
              {venue.score.explanations.map((explanation) => (
                <li key={explanation}>{explanation}</li>
              ))}
            </ul>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-stone-800">
              Travel for each person
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="pb-1 font-medium">Person</th>
                  <th className="pb-1 font-medium">Distance</th>
                  <th className="pb-1 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {venue.travel.map((estimate) => (
                  <tr key={estimate.participantId} className="border-t border-stone-100">
                    <td className="py-1.5 font-medium text-stone-800">
                      {estimate.displayName}
                    </td>
                    <td className="py-1.5">
                      {formatKm(estimate.distanceKm)}
                      {estimate.isStraightLine && (
                        <span className="ml-1 text-xs text-stone-400">
                          straight-line
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {estimate.durationMin != null
                        ? `${formatMinutes(estimate.durationMin)} (est.)`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Separator />

          <section className="flex flex-col gap-1.5 text-sm">
            <h3 className="text-sm font-semibold text-stone-800">
              Details
            </h3>
            <DetailRow label="Cuisines">
              {venue.cuisine?.length
                ? venue.cuisine.map(cuisineLabel).join(", ")
                : "Not available"}
            </DetailRow>
            <DetailRow label="Opening hours">
              {venue.openingHours ?? "Not available"}
            </DetailRow>
            <DetailRow label="Price">
              {venue.price != null ? `~₹${venue.price} per person` : "Unknown"}
            </DetailRow>
            <DetailRow label="Address">
              {venue.address ?? "Not available"}
            </DetailRow>
            <DetailRow label="Outdoor seating">
              {venue.outdoorSeating === null
                ? "Not available"
                : venue.outdoorSeating
                  ? "Yes"
                  : "No"}
            </DetailRow>
            <DetailRow label="Wheelchair access">
              {venue.accessibility ?? "Not available"}
            </DetailRow>
            {venue.website && (
              <DetailRow label="Website">
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </DetailRow>
            )}
            {venue.phone && (
              <DetailRow label="Phone">{venue.phone}</DetailRow>
            )}
            <DetailRow label="Source">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {venue.demo
                  ? "Built-in demo data"
                  : `OpenStreetMap ${venue.osmType}/${venue.osmId}`}
              </span>
            </DetailRow>
          </section>

          <p className="text-xs text-stone-500">
            Ratings and reviews aren&apos;t available from
            OpenStreetMap, so no star rating is shown. In-room
            votes are the group&apos;s signal.
          </p>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 text-xs text-stone-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${Math.round(value)}%` }}
          role="img"
          aria-label={`${label}: ${Math.round(value)} out of 100`}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-stone-700">
        {Math.round(value)}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-stone-500">{label}</span>
      <span className="min-w-0 text-stone-800">{children}</span>
    </div>
  );
}
