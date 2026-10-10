"use client";

import { useState } from "react";
import {
  Crosshair,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenueMap } from "@/components/map/VenueMap";
import { LocationSearch } from "@/components/location/LocationSearch";
import { useToast } from "@/components/ui/toaster";
import type {
  GeocodingResult,
  LatLng,
  LocationPrecision,
  RoomState,
} from "@/types";

interface Draft {
  label: string;
  lat: number;
  lng: number;
  precision: LocationPrecision;
}

export function LocationStep({
  state,
  onChanged,
}: {
  state: RoomState;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [label, setLabel] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = state.myLocation;

  function useCurrentLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError(
        "This browser can't determine your location. Search manually instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft({
          label: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          precision: "gps",
        });
        setLabel("Current location");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permission denied. Allow location access in your browser, or search manually."
            : "Couldn't get your location right now. Try searching manually.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
  }

  function handleSearchResult(result: GeocodingResult) {
    setDraft({
      label: result.label,
      lat: result.lat,
      lng: result.lng,
      precision: "search",
    });
    setLabel(result.label);
    setError(null);
  }

  function handleMapPick(point: LatLng) {
    setDraft({
      label: "Pinned location",
      lat: point.lat,
      lng: point.lng,
      precision: "pin",
    });
    setLabel("Pinned location");
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/location`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, label: label.trim() || draft.label }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save location");
      toast("Location saved", "success");
      setDraft(null);
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not save location",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/location`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Could not remove location");
      }
      toast("Location removed", "info");
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not remove location",
        "error",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-stone-900">
            Your starting point
          </h2>
          <p className="text-sm text-stone-600">
            We calculate how far each venue is from here. Only
            the travel estimates are shared with the room —
            never your exact address.
          </p>
        </div>

        {mine && !draft && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-900">
                  <MapPin className="h-4 w-4" />
                  {mine.label}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Saved. You can change or remove it any time.
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDraft({
                      label: mine.label,
                      lat: mine.lat,
                      lng: mine.lng,
                      precision: "search",
                    });
                    setLabel(mine.label);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Change
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={removing}
                  onClick={remove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <Button
          variant="secondary"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
          {locating ? "Locating…" : "Use my current location"}
        </Button>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-search">
            Or search manually
          </Label>
          <LocationSearch onSelect={handleSearchResult} />
          <p className="text-xs text-stone-500">
            A neighbourhood or landmark is fine — you don&apos;t
            need an exact address.
          </p>
        </div>

        {draft && (
          <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location-label">Label</Label>
              <Input
                id="location-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={200}
              />
            </div>
            <p className="text-xs text-stone-500">
              {draft.precision === "gps"
                ? "From your device's GPS."
                : draft.precision === "search"
                  ? "From place search."
                  : "Pinned on the map."}
            </p>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save location"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-0">
        <VenueMap
          venues={[]}
          center={
            draft ??
            mine ?? {
              lat: 28.6139,
              lng: 77.209,
            }
          }
          onPick={handleMapPick}
          className="h-80 lg:h-full lg:min-h-96"
        />
        <p className="px-3 pb-3 text-xs text-stone-500">
          Tip: click anywhere on the map to drop a pin.
        </p>
      </Card>
    </div>
  );
}
