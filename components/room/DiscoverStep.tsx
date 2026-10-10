"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Compass,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VenueMap } from "@/components/map/VenueMap";
import { VenueCard } from "@/components/room/VenueCard";
import { VenueDetailsDialog } from "@/components/room/VenueDetailsDialog";
import { useToast } from "@/components/ui/toaster";
import { categoryLabel } from "@/lib/venues/categories";
import type { RankedVenue, RoomState } from "@/types";

interface DiscoveryResult {
  venues: RankedVenue[];
  demo: boolean;
  notices: string[];
  failures: { venueId: string; reasons: string[] }[];
  center: { lat: number; lng: number };
  radiusKm: number;
}

export function DiscoverStep({
  state,
  onChanged,
}: {
  state: RoomState;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [results, setResults] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [detailsVenue, setDetailsVenue] = useState<RankedVenue | null>(null);

  const shortlistedIds = useMemo(
    () => new Set(state.shortlist.map((s) => s.venueId)),
    [state.shortlist],
  );

  const missing = state.participants.filter(
    (p) => !p.hasLocation || !p.hasPreferences,
  );

  async function runDiscovery() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/discover`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      setResults(data as DiscoveryResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Discovery failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleShortlist(venue: RankedVenue) {
    const action = shortlistedIds.has(venue.id) ? "remove" : "add";
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/shortlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId: venue.id,
            action,
            venue: action === "add" ? venue : undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update shortlist");
      toast(
        action === "add" ? "Added to shortlist" : "Removed from shortlist",
        "success",
      );
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not update shortlist",
        "error",
      );
    }
  }

  const visibleVenues = useMemo(() => {
    const venues = results?.venues ?? [];
    return venues.filter((venue) => {
      if (categoryFilter && !venue.categories.includes(categoryFilter)) {
        return false;
      }
      if (shortlistedOnly && !shortlistedIds.has(venue.id)) return false;
      return true;
    });
  }, [results, categoryFilter, shortlistedOnly, shortlistedIds]);

  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const venue of results?.venues ?? []) {
      for (const category of venue.categories) set.add(category);
    }
    return [...set];
  }, [results]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-stone-900">
            Discover venues
          </h2>
          <p className="text-sm text-stone-600">
            {missing.length === 0
              ? "Everyone has shared a location and preferences."
              : `${missing.length} of ${state.participants.length} haven't shared everything yet — results only reflect participants who have.`}
          </p>
        </div>
        <Button onClick={runDiscovery} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Compass className="h-4 w-4" />
          )}
          {loading ? "Searching…" : "Find spots"}
        </Button>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {results && (
        <>
          {results.notices.map((notice) => (
            <p
              key={notice}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          ))}

          {results.venues.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <MapPin className="h-8 w-8 text-stone-300" />
              <h3 className="font-semibold text-stone-900">
                No venues matched
              </h3>
              <p className="max-w-md text-sm text-stone-600">
                Every candidate was excluded by at least one
                participant&apos;s required constraints.
                {results.failures.length > 0 &&
                  ` Common reasons: ${results.failures
                    .flatMap((f) => f.reasons)
                    .slice(0, 2)
                    .join("; ")}.`}
              </p>
              <p className="text-xs text-stone-500">
                Required constraints are never changed
                automatically — ask the group to relax an
                optional preference, or widen the area by
                moving a starting point.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {usedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setCategoryFilter(
                        categoryFilter === category ? null : category,
                      )
                    }
                    aria-pressed={categoryFilter === category}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      categoryFilter === category
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {categoryLabel(category)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShortlistedOnly(!shortlistedOnly)}
                  aria-pressed={shortlistedOnly}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    shortlistedOnly
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <Bookmark className="h-3 w-3" />
                  Shortlisted
                </button>
              </div>

              {visibleVenues.length === 0 ? (
                <Card className="p-8 text-center text-sm text-stone-600">
                  Nothing matches these filters.
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-5">
                  <div className="lg:order-1 lg:col-span-2">
                    <div className="lg:sticky lg:top-4">
                      <VenueMap
                        venues={visibleVenues}
                        center={results.center}
                        className="h-72 lg:h-[520px]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 lg:order-2 lg:col-span-3">
                    {visibleVenues.map((venue, index) => (
                      <VenueCard
                        key={venue.id}
                        venue={venue}
                        index={index}
                        state={state}
                        shortlisted={shortlistedIds.has(venue.id)}
                        onToggleShortlist={() => toggleShortlist(venue)}
                        onDetails={() => setDetailsVenue(venue)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!results && !loading && !error && (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Compass className="h-10 w-10 text-stone-300" />
          <h3 className="font-semibold text-stone-900">
            Ready when you are
          </h3>
          <p className="max-w-md text-sm text-stone-600">
            We&apos;ll search OpenStreetMap venues around the
            group&apos;s starting points, apply everyone&apos;s
            required constraints, and rank by travel
            fairness and preference match.
          </p>
        </Card>
      )}

      <VenueDetailsDialog
        venue={detailsVenue}
        onClose={() => setDetailsVenue(null)}
      />
    </div>
  );
}
