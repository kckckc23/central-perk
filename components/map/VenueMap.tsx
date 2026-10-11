"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle } from "lucide-react";
import { publicConfig } from "@/lib/config/public";
import type { LatLng, Venue } from "@/types";

interface VenueMapProps {
  venues: Venue[];
  center: LatLng;
  /** Enables click-to-place-pin mode (location step). */
  onPick?: (point: LatLng) => void;
  className?: string;
}

/**
 * MapLibre map with OpenStreetMap-based tiles.
 * Degrades gracefully: if the style/tile endpoint is
 * unreachable, a clear notice is shown and the list
 * view remains fully usable.
 */
export function VenueMap({
  venues,
  center,
  onPick,
  className,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapError, setMapError] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: publicConfig.mapStyleUrl,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: {},
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.on("error", () => {
      if (!disposed) setMapError(true);
    });
    map.on("click", (e) => {
      onPickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;
    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync venue markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    if (venues.length > 0) {
      const bounds = new maplibregl.LngLatBounds(
        [venues[0].lng, venues[0].lat],
        [venues[0].lng, venues[0].lat],
      );
      venues.forEach((venue, i) => {
        const el = document.createElement("div");
        el.className = "venue-marker";
        el.textContent = String(i + 1);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([venue.lng, venue.lat])
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([venue.lng, venue.lat]);
      });
      map.fitBounds(bounds, {
        padding: 70,
        maxZoom: 15,
        duration: 0,
      });
    } else {
      map.jumpTo({ center: [center.lng, center.lat], zoom: 13 });
    }
  }, [venues, center.lat, center.lng]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="h-full w-full rounded-xl border border-stone-200 bg-stone-100"
        role="application"
        aria-label="Map of venues"
      />
      {mapError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Map tiles could not be loaded. The venue list below still
            works — check back later or configure a self-hosted tile
            style.
          </span>
        </div>
      )}
    </div>
  );
}
