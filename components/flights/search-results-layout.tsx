"use client";

import { useState, useMemo } from "react";
import { Plane, MapPin, Clock, ArrowRight, ArrowRightLeft } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { NormalizedFlightOffer } from "@/lib/types";

type Props = {
  offers: NormalizedFlightOffer[];
  offerRequestId: string;
  onSelectOffer: (offer: NormalizedFlightOffer) => Promise<void>;
};

export function SearchResultsLayout({ offers, offerRequestId, onSelectOffer }: Props) {
  const [sortBy, setSortBy] = useState<"least_expensive" | "most_expensive">("least_expensive");
  const [stopsFilter, setStopsFilter] = useState<"any" | "direct" | "one_stop">("any");
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [flightNumberQuery, setFlightNumberQuery] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Extract unique airlines from offers for filter dropdown
  const airlines = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.ownerName) set.add(o.ownerName);
    });
    return Array.from(set);
  }, [offers]);

  // Apply filters and sorting
  const filteredOffers = useMemo(() => {
    let result = [...offers];

    // Filter by stops
    if (stopsFilter !== "any") {
      result = result.filter((o) => {
        const firstSlice = o.slices[0];
        const stopsCount = (firstSlice?.segments?.length ?? 1) - 1;
        if (stopsFilter === "direct") return stopsCount === 0;
        if (stopsFilter === "one_stop") return stopsCount === 1;
        return true;
      });
    }

    // Filter by airline
    if (selectedAirline !== "all") {
      result = result.filter((o) => o.ownerName === selectedAirline);
    }

    // Filter by flight number
    if (flightNumberQuery.trim()) {
      const q = flightNumberQuery.trim().toLowerCase();
      result = result.filter((o) =>
        o.slices.some((s) =>
          s.segments.some((seg) => seg.flightNumber?.toLowerCase().includes(q))
        )
      );
    }

    // Sort
    result.sort((a, b) => {
      const priceA = parseFloat(a.totalAmount);
      const priceB = parseFloat(b.totalAmount);
      return sortBy === "least_expensive" ? priceA - priceB : priceB - priceA;
    });

    return result;
  }, [offers, sortBy, stopsFilter, selectedAirline, flightNumberQuery]);

  async function handleSelect(offer: NormalizedFlightOffer) {
    setSelectingId(offer.id);
    try {
      await onSelectOffer(offer);
    } catch {
      setSelectingId(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* Filters Sidebar */}
      <aside className="h-fit rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card lg:sticky lg:top-24">
        <h3 className="text-lg font-black text-ink">Sort & Filters</h3>

        <div className="mt-6 space-y-6">
          {/* Sort By */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">Sort by</p>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === "least_expensive"}
                  onChange={() => setSortBy("least_expensive")}
                  className="h-4 w-4 text-orangebrand focus:ring-orangebrand"
                />
                Least expensive
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === "most_expensive"}
                  onChange={() => setSortBy("most_expensive")}
                  className="h-4 w-4 text-orangebrand focus:ring-orangebrand"
                />
                Most expensive
              </label>
            </div>
          </div>

          {/* Stops */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">Stops</p>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer">
                <input
                  type="radio"
                  name="stops"
                  checked={stopsFilter === "any"}
                  onChange={() => setStopsFilter("any")}
                  className="h-4 w-4 text-orangebrand focus:ring-orangebrand"
                />
                Any number of stops
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer">
                <input
                  type="radio"
                  name="stops"
                  checked={stopsFilter === "direct"}
                  onChange={() => setStopsFilter("direct")}
                  className="h-4 w-4 text-orangebrand focus:ring-orangebrand"
                />
                Direct only
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer">
                <input
                  type="radio"
                  name="stops"
                  checked={stopsFilter === "one_stop"}
                  onChange={() => setStopsFilter("one_stop")}
                  className="h-4 w-4 text-orangebrand focus:ring-orangebrand"
                />
                1 stop at most
              </label>
            </div>
          </div>

          {/* Airlines */}
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">Airlines</label>
            <select
              value={selectedAirline}
              onChange={(e) => setSelectedAirline(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-orange-100 bg-cloud px-4 py-3 text-sm font-bold text-ink focus-ring"
            >
              <option value="all">All airlines</option>
              {airlines.map((airline) => (
                <option key={airline} value={airline}>
                  {airline}
                </option>
              ))}
            </select>
          </div>

          {/* Flight Number */}
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">Flight number</label>
            <input
              type="text"
              placeholder="e.g. AA0688"
              value={flightNumberQuery}
              onChange={(e) => setFlightNumberQuery(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-orange-100 bg-cloud px-4 py-3 text-sm font-bold text-ink focus-ring"
            />
          </div>
        </div>
      </aside>

      {/* Main Results Container */}
      <div>
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink/45">Search reference</p>
            <p className="font-mono text-sm font-semibold text-ink/60">{offerRequestId}</p>
          </div>
          <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-orangeburnt shadow-sm ring-1 ring-orange-100">
            {filteredOffers.length} offers match
          </p>
        </div>

        {/* Flight Rows */}
        <div className="grid gap-5">
          {filteredOffers.length > 0 ? (
            filteredOffers.map((offer) => (
              <article
                key={offer.id}
                className="rounded-[2.5rem] border border-orange-100 bg-white p-6 shadow-card transition hover:border-orangebrand/30"
              >
                <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
                  {/* Left Column: Itineraries */}
                  <div className="space-y-6">
                    {offer.slices.map((slice, sliceIndex) => {
                      const firstSegment = slice.segments[0];
                      const lastSegment = slice.segments[slice.segments.length - 1];
                      const stopsCount = slice.segments.length - 1;

                      return (
                        <div key={`${slice.originCode}-${sliceIndex}`} className="flex items-center gap-6">
                          {/* Airline Marker */}
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orangebrand/10 text-orangebrand">
                            <Plane className="h-5 w-5" />
                          </span>

                          <div className="flex-1 grid gap-4 sm:grid-cols-3 sm:items-center">
                            {/* Origin to Destination codes */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-ink">{slice.originCode}</span>
                                <ArrowRight className="h-4 w-4 text-orangebrand" />
                                <span className="text-xl font-black text-ink">{slice.destinationCode}</span>
                              </div>
                              <p className="text-xs font-bold text-ink/45 uppercase mt-0.5">{offer.ownerName}</p>
                            </div>

                            {/* Departure timing */}
                            <div>
                              <p className="text-sm font-black text-ink">
                                {new Date(slice.departingAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-xs font-semibold text-ink/55 mt-0.5">
                                {new Date(slice.departingAt).toLocaleDateString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>

                            {/* Duration / Stops info */}
                            <div>
                              <p className="text-sm font-black text-ink">
                                {stopsCount === 0 ? "Direct" : `${stopsCount} stop${stopsCount > 1 ? "s" : ""}`}
                              </p>
                              {stopsCount > 0 && (
                                <p className="text-xs font-bold text-orangeburnt mt-0.5">
                                  via {slice.segments[0].destinationCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: Pricing details */}
                  <div className="flex flex-col justify-between rounded-[1.75rem] bg-cloud p-5 border border-orangebrand/5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">Total fare</p>
                      <p className="mt-1 text-3xl font-black text-ink">
                        {formatCurrency(offer.totalAmount, offer.totalCurrency)}
                      </p>
                      <p className="text-xs font-semibold text-ink/50 mt-1">Includes checked bags & fees</p>
                    </div>

                    <button
                      onClick={() => handleSelect(offer)}
                      disabled={selectingId !== null}
                      className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-orangebrand text-sm font-black text-white shadow-glow transition hover:bg-orangeburnt disabled:opacity-50"
                    >
                      {selectingId === offer.id ? "Preparing checkout..." : "Select flights"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[2rem] bg-white p-12 text-center shadow-card border border-orange-100">
              <p className="text-2xl font-black text-ink">No flights match your filters.</p>
              <p className="mt-2 text-sm text-ink/55">Try relaxing your search options above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
