"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import type { GeocodingResult } from "@/types";
import { Input } from "@/components/ui/input";

interface LocationSearchProps {
  onSelect: (result: GeocodingResult) => void;
  disabled?: boolean;
}

/**
 * Debounced place autocomplete that calls the
 * server-side geocode API. Photon's URL is a
 * server-only variable, so it must never be
 * imported from a client component.
 */
export function LocationSearch({
  onSelect,
  disabled,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (
        boxRef.current &&
        !boxRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) throw new Error("Geocoding request failed.");
        const data = (await res.json()) as {
          results?: GeocodingResult[];
          error?: string;
        };
        setResults(Array.isArray(data.results) ? data.results : []);
        setError(data.error ?? null);
        setOpen(true);
      } catch {
        setResults([]);
        setError("Place search is unavailable right now.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a neighbourhood, address or landmark…"
          aria-label="Search for a place"
          autoComplete="off"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
          {error}
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          {results.map((result, index) => (
            <li key={`${result.lat}-${result.lng}-${index}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-stone-50 focus:bg-stone-50 focus:outline-2 focus:outline-brand-600"
                onClick={() => {
                  onSelect(result);
                  setOpen(false);
                  setQuery(result.label);
                }}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span>
                  <span className="block font-medium text-stone-800">
                    {result.label}
                  </span>
                  {result.context && (
                    <span className="block text-xs text-stone-500">
                      {result.context}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="absolute z-30 mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-500 shadow-lg">
          No places found. Try a nearby landmark or city name.
        </p>
      )}
    </div>
  );
}
