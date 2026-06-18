"use client";

import { useEffect, useRef, useState } from "react";
import { Plane, MapPin, Loader2 } from "lucide-react";
import { Field, Input } from "@/components/ui/input";

type Suggestion = {
  id: string;
  type: "airport" | "city";
  iataCode: string;
  name: string;
  cityName: string;
  countryCode: string;
};

type Props = {
  label: string;
  name: string;
  defaultCode: string;
  defaultLabel: string;
  iconRotate?: boolean;
};

export function PlaceAutocomplete({ label, name, defaultCode, defaultLabel, iconRotate = false }: Props) {
  const [query, setQuery] = useState(`${defaultLabel} (${defaultCode})`);
  const [selectedCode, setSelectedCode] = useState(defaultCode);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    // Don't search if the query perfectly matches the current selected name
    if (query === `${defaultLabel} (${defaultCode})` || query.endsWith(`(${selectedCode})`)) {
      setSuggestions([]);
      return;
    }

    const cleanedQuery = query.split(" (")[0].trim();
    if (cleanedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/flights/places?query=${encodeURIComponent(cleanedQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query, isOpen, selectedCode, defaultLabel, defaultCode]);

  // Close dropdown on click outside
  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  function handleSelect(suggestion: Suggestion) {
    const textLabel = suggestion.type === "city" ? suggestion.name : `${suggestion.cityName} ${suggestion.name}`;
    setQuery(`${textLabel} (${suggestion.iataCode})`);
    setSelectedCode(suggestion.iataCode);
    setSuggestions([]);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden field actually submitted to /flights/search */}
      <input type="hidden" name={name} value={selectedCode} />

      <Field label={label}>
        <div className="relative">
          <Plane
            className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand transition ${
              iconRotate ? "rotate-45" : ""
            }`}
          />
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            required
            className="h-16 rounded-[1.1rem] border-orange-100 pl-12 pr-10 text-base font-bold text-ink focus-ring"
            placeholder="Search city or airport..."
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-orangebrand" />
          )}
        </div>
      </Field>

      {/* Suggestion Dropdown */}
      {isOpen && (suggestions.length > 0 || query.length >= 2) && (
        <div className="absolute left-0 z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-3xl border border-orangebrand/10 bg-white p-2 shadow-[0_12px_45px_rgba(15,23,42,0.15)] focus:outline-none">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => {
              const Icon = suggestion.type === "airport" ? Plane : MapPin;
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition hover:bg-orangebrand/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 truncate">
                    <p className="font-black text-ink truncate">
                      {suggestion.type === "city" ? suggestion.name : suggestion.cityName}
                    </p>
                    {suggestion.type === "airport" && (
                      <p className="text-xs font-semibold text-ink/50 truncate">{suggestion.name}</p>
                    )}
                  </div>
                  <span className="rounded-lg bg-orangebrand/15 px-2 py-1 text-xs font-black text-orangebrand">
                    {suggestion.iataCode}
                  </span>
                </button>
              );
            })
          ) : (
            !loading && (
              <p className="py-4 text-center text-sm font-semibold text-ink/50">No matching places found.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
