/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useMemo } from "react";
import { Plane, ArrowRightLeft, Check, Search, Calendar, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { NormalizedFlightOffer } from "@/lib/types";
import { HeroBookingWidget } from "@/components/hero-booking-widget";

type Props = {
  offers: NormalizedFlightOffer[];
  offerRequestId: string;
  searchParams?: {
    tripType: "one-way" | "round-trip";
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    cabinClass: "economy" | "premium_economy" | "business" | "first";
    takeoffStart?: string;
    takeoffEnd?: string;
    landingStart?: string;
    landingEnd?: string;
  };
  onSelectOffer: (offer: NormalizedFlightOffer) => Promise<void>;
};

function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 999999;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 999999;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  return hours * 60 + minutes;
}

function getOfferTotalDuration(offer: NormalizedFlightOffer): number {
  return offer.slices.reduce((total, slice) => total + parseDurationToMinutes(slice.duration), 0);
}

function formatDurationString(duration?: string) {
  if (!duration) return "N/A";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration.replace("PT", "").toLowerCase();
  const hrs = match[1] ? `${match[1]}h` : "";
  const mins = match[2] ? `${match[2]}m` : "";
  return `${hrs} ${mins}`.trim() || "0m";
}

function getLayoverDetails(slice: NormalizedFlightOffer["slices"][0]) {
  if (slice.segments.length < 2) return null;
  const seg0 = slice.segments[0];
  const seg1 = slice.segments[1];
  const diffMs = new Date(seg1.departingAt).getTime() - new Date(seg0.arrivingAt).getTime();
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins}m layover in ${seg0.destinationCode}`;
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function getOfferScheduleKey(offer: NormalizedFlightOffer): string {
  return offer.slices.map((slice) => {
    const firstSeg = slice.segments[0];
    return `${slice.originCode}-${slice.destinationCode}-${firstSeg?.operatingCarrierName}-${firstSeg?.flightNumber}-${slice.departingAt}`;
  }).join("|");
}

export function SearchResultsLayout({ offers, offerRequestId, searchParams, onSelectOffer }: Props) {
  const [showSearchWidget, setShowSearchWidget] = useState(false);
  const [sortBy, setSortBy] = useState<"least_expensive" | "most_expensive" | "shortest_duration" | "longest_duration">("least_expensive");
  const [stopsFilter, setStopsFilter] = useState<"any" | "direct" | "one_stop" | "two_stops">("any");
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [flightNumberQuery, setFlightNumberQuery] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Fare options step state
  const [selectedScheduleKey, setSelectedScheduleKey] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<NormalizedFlightOffer | null>(null);

  // Extract unique airlines from offers for filter dropdown
  const airlines = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.ownerName) set.add(o.ownerName);
    });
    return Array.from(set).sort();
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
        if (stopsFilter === "one_stop") return stopsCount <= 1;
        if (stopsFilter === "two_stops") return stopsCount <= 2;
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

    // Filter by Take-off Time parameters from URL
    if (searchParams?.takeoffStart && searchParams?.takeoffEnd) {
      const minHr = parseInt(searchParams.takeoffStart, 10);
      const maxHr = parseInt(searchParams.takeoffEnd, 10);
      result = result.filter((o) => {
        const outboundSlice = o.slices[0];
        if (!outboundSlice) return true;
        const hr = new Date(outboundSlice.departingAt).getHours();
        return hr >= minHr && hr <= maxHr;
      });
    }

    // Filter by Landing Time parameters from URL
    if (searchParams?.landingStart && searchParams?.landingEnd) {
      const minHr = parseInt(searchParams.landingStart, 10);
      const maxHr = parseInt(searchParams.landingEnd, 10);
      result = result.filter((o) => {
        const outboundSlice = o.slices[0];
        if (!outboundSlice) return true;
        const hr = new Date(outboundSlice.arrivingAt).getHours();
        return hr >= minHr && hr <= maxHr;
      });
    }

    return result;
  }, [offers, stopsFilter, selectedAirline, flightNumberQuery, searchParams]);

  // Group filtered offers by their unique schedule keys (so we display schedules uniquely)
  const groupedScheduleOffers = useMemo(() => {
    const groups: Record<string, NormalizedFlightOffer[]> = {};
    filteredOffers.forEach((offer) => {
      const key = getOfferScheduleKey(offer);
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    });

    const uniqueList: NormalizedFlightOffer[] = [];
    Object.keys(groups).forEach((key) => {
      const list = groups[key];
      // Sort each schedule list so the cheapest offer is first
      list.sort((a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount));
      if (list[0]) {
        uniqueList.push(list[0]);
      }
    });

    // Sort unique list by selected sortBy
    uniqueList.sort((a, b) => {
      if (sortBy === "least_expensive") {
        return parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
      } else if (sortBy === "most_expensive") {
        return parseFloat(b.totalAmount) - parseFloat(a.totalAmount);
      } else if (sortBy === "shortest_duration") {
        return getOfferTotalDuration(a) - getOfferTotalDuration(b);
      } else if (sortBy === "longest_duration") {
        return getOfferTotalDuration(b) - getOfferTotalDuration(a);
      }
      return 0;
    });

    return { uniqueList, groups };
  }, [filteredOffers, sortBy]);

  // Handle select flight schedule to enter Fare Selection step
  function handleSelectSchedule(offer: NormalizedFlightOffer) {
    const key = getOfferScheduleKey(offer);
    setSelectedScheduleKey(key);
    // Auto-select the first (cheapest) offer by default
    const matchingOffers = groupedScheduleOffers.groups[key] || [];
    setSelectedOffer(matchingOffers[0] || offer);
  }

  // Handle proceed to checkout with the selected real offer
  async function handleGoToCheckout() {
    if (!selectedOffer) return;

    setSelectingId(selectedOffer.id);
    try {
      await onSelectOffer(selectedOffer);
    } catch {
      setSelectingId(null);
    }
  }

  // Get matching offers (fare options) for the selected schedule
  const availableFareOffers = useMemo(() => {
    if (!selectedScheduleKey) return [];
    return groupedScheduleOffers.groups[selectedScheduleKey] || [];
  }, [selectedScheduleKey, groupedScheduleOffers]);

  // --- FARE OPTIONS STEP RENDERING ---
  if (selectedScheduleKey && selectedOffer) {
    const isRoundTrip = searchParams?.tripType === "round-trip";
    const outboundSlice = selectedOffer.slices[0];
    const inboundSlice = isRoundTrip ? selectedOffer.slices[1] : null;

    return (
      <div className="space-y-6 animate-scaleIn">
        {/* Dynamic Breadcrumbs Nav */}
        <nav className="flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => { setSelectedScheduleKey(null); setSelectedOffer(null); }}>Orders</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => { setSelectedScheduleKey(null); setSelectedOffer(null); }}>New order</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => { setSelectedScheduleKey(null); setSelectedOffer(null); }}>{searchParams?.origin || "Origin"} to {searchParams?.destination || "Destination"}</span>
          {isRoundTrip && (
            <>
              <span>&rsaquo;</span>
              <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => { setSelectedScheduleKey(null); setSelectedOffer(null); }}>{searchParams?.destination || "Destination"} to {searchParams?.origin || "Origin"}</span>
            </>
          )}
          <span>&rsaquo;</span>
          <span className="text-ink/65 font-black">Fare options</span>
        </nav>

        {/* Fare Options Layout Grid with sidebar */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          
          {/* Fares selection area */}
          <div className="space-y-10">
            {/* Outbound schedule timing preview */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-3">
                <span className="text-xs font-black uppercase tracking-widest bg-orangebrand px-3 py-1 text-white rounded-full">Outbound</span>
                <span className="text-xs font-black text-ink/40">{formatDateShort(searchParams?.departureDate)}</span>
              </div>

              <div className="flex items-center justify-between bg-cloud rounded-3xl p-5 border border-orange-50/70">
                <div className="flex items-center gap-4">
                  {selectedOffer.ownerIataCode ? (
                    <img
                      src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${selectedOffer.ownerIataCode}.png`}
                      alt={selectedOffer.ownerName}
                      className="h-9 w-auto max-w-[85px] object-contain filter brightness-95"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand"><Plane className="h-4.5 w-4.5" /></span>
                  )}
                  <div>
                    <p className="text-sm font-black text-ink">
                      {new Date(outboundSlice.departingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(outboundSlice.arrivingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] font-black text-ink/40 uppercase mt-0.5">{outboundSlice.originCode} – {outboundSlice.destinationCode}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-ink">{formatDurationString(outboundSlice.duration)}</p>
                  <p className="text-[10px] font-black text-orangebrand uppercase mt-0.5">
                    {outboundSlice.segments.length - 1 === 0 ? "Non-stop" : `${outboundSlice.segments.length - 1} stop`}
                  </p>
                </div>
              </div>
            </div>

            {/* Inbound schedule timing preview if return */}
            {isRoundTrip && inboundSlice && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-orange-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-widest bg-orangebrand px-3 py-1 text-white rounded-full">Inbound</span>
                  <span className="text-xs font-black text-ink/40">{formatDateShort(searchParams?.returnDate)}</span>
                </div>

                <div className="flex items-center justify-between bg-cloud rounded-3xl p-5 border border-orange-50/70">
                  <div className="flex items-center gap-4">
                    {selectedOffer.ownerIataCode ? (
                      <img
                        src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${selectedOffer.ownerIataCode}.png`}
                        alt={selectedOffer.ownerName}
                        className="h-9 w-auto max-w-[85px] object-contain filter brightness-95"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand"><Plane className="h-4.5 w-4.5" /></span>
                    )}
                    <div>
                      <p className="text-sm font-black text-ink">
                        {new Date(inboundSlice.departingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(inboundSlice.arrivingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] font-black text-ink/40 uppercase mt-0.5">{inboundSlice.originCode} – {inboundSlice.destinationCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-ink">{formatDurationString(inboundSlice.duration)}</p>
                    <p className="text-[10px] font-black text-orangebrand uppercase mt-0.5">
                      {inboundSlice.segments.length - 1 === 0 ? "Non-stop" : `${inboundSlice.segments.length - 1} stop`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* REAL OFFER FARE OPTION CARDS DIRECT FROM DUFFEL */}
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-ink/40">Select your fare brand</p>
              
              <div className="grid gap-4 md:grid-cols-3">
                {availableFareOffers.map((fareOffer) => {
                  const isSelected = selectedOffer.id === fareOffer.id;
                  const firstSliceFareBrand = fareOffer.slices[0]?.fareBrandName || "Economy";
                  
                  return (
                    <div
                      key={fareOffer.id}
                      onClick={() => setSelectedOffer(fareOffer)}
                      className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                        isSelected
                          ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                          : "border-slate-200 bg-white hover:border-orangebrand/50"
                      }`}
                    >
                      <div className="absolute right-4 top-4">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          isSelected ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">
                          {fareOffer.slices[0]?.segments[0]?.operatingCarrierName || fareOffer.ownerName}
                        </span>
                        <h4 className="text-base font-black text-ink mt-0.5 truncate">{firstSliceFareBrand}</h4>
                        
                        <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                          <li className="flex items-center gap-1.5 truncate">
                            <span className={fareOffer.conditions?.changeBeforeDeparture ? "text-orangebrand" : "text-slate-300"}>
                              {fareOffer.conditions?.changeBeforeDeparture ? "✓" : "➜"}
                            </span>
                            <span className="truncate">{fareOffer.conditions?.changeBeforeDeparture || "No data on changes"}</span>
                          </li>
                          <li className="flex items-center gap-1.5 truncate">
                            <span className={fareOffer.conditions?.refundBeforeDeparture ? "text-orangebrand" : "text-slate-300"}>
                              {fareOffer.conditions?.refundBeforeDeparture ? "✓" : "➜"}
                            </span>
                            <span className="truncate">{fareOffer.conditions?.refundBeforeDeparture || "No data on refunds"}</span>
                          </li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Hold price & space</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes carry-on bags</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes checked bags</li>
                        </ul>
                      </div>

                      <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                        <span className="text-[10px] font-black text-ink/35 block">total amount</span>
                        <span className="text-lg font-black text-ink">
                          {formatCurrency(fareOffer.totalAmount, fareOffer.totalCurrency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Summary Sidebar Box */}
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card text-ink flex flex-col justify-between h-fit">
              <div>
                <h3 className="text-lg font-black tracking-tight border-b border-orange-50 pb-4">Summary</h3>
                <div className="mt-4 space-y-4 text-xs font-black text-ink/65">
                  <p className="flex items-center gap-1.5">
                    Sold by <span className="font-black text-orangebrand">{selectedOffer.ownerName}</span>
                  </p>
                  
                  <ul className="space-y-2 text-[11px] font-bold text-ink/50 border-t border-b border-orange-50/50 py-3">
                    <li className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-300">➜</span> {selectedOffer.conditions?.changeBeforeDeparture || "No data on changes"}
                    </li>
                    <li className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-300">➜</span> {selectedOffer.conditions?.refundBeforeDeparture || "No data on refunds"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> Hold space for 1 day
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> Includes carry-on bags
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> Includes checked bags
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> 86kg CO2
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-ink select-none border-b border-slate-50 pb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Total amount</span>
                  <span className="text-xl font-black text-orangebrand">
                    {formatCurrency(selectedOffer.totalAmount, selectedOffer.totalCurrency)}
                  </span>
                </div>

                <button
                  onClick={handleGoToCheckout}
                  disabled={selectingId !== null}
                  className="w-full h-12 rounded-2xl bg-black text-xs font-black text-white hover:bg-slate-900 transition flex items-center justify-center gap-2 select-none"
                >
                  {selectingId ? "Securing booking..." : "Go to checkout"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={() => { setSelectedScheduleKey(null); setSelectedOffer(null); }}
              className="w-full h-11 rounded-2xl border border-slate-200 bg-white text-xs font-black text-ink/50 hover:bg-slate-50 transition"
            >
              Back to search results
            </button>
          </aside>

        </div>
      </div>
    );
  }

  // --- STANDARD FLIGHT ROWS LIST RENDERING ---
  return (
    <div className="space-y-6">
      {/* Dynamic Breadcrumbs Nav */}
      <nav className="flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
        <span className="hover:text-orangebrand transition cursor-pointer">Orders</span>
        <span>&rsaquo;</span>
        <span className="hover:text-orangebrand transition cursor-pointer">New order</span>
        <span>&rsaquo;</span>
        <span className="text-orangebrand font-black">{searchParams?.origin || "Origin"} to {searchParams?.destination || "Destination"}</span>
        {searchParams?.tripType === "round-trip" && (
          <>
            <span>&rsaquo;</span>
            <span className="hover:text-orangebrand transition cursor-pointer">{searchParams?.destination || "Destination"} to {searchParams?.origin || "Origin"}</span>
          </>
        )}
        <span>&rsaquo;</span>
        <span className="text-ink/65 font-black">Fare options</span>
      </nav>

      {/* Collapsible Edit Search Widget Panel */}
      {showSearchWidget && (
        <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card animate-scaleIn">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-orange-50">
            <h3 className="text-lg font-black text-ink">Modify your flight search</h3>
            <button
              onClick={() => setShowSearchWidget(false)}
              className="rounded-full bg-cloud px-4 py-2 text-xs font-black text-ink/50 hover:bg-orange-100 hover:text-orangebrand transition"
            >
              Close
            </button>
          </div>
          <HeroBookingWidget />
        </div>
      )}

      {/* Main Page Layout Grid */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        
        {/* Filters Sidebar */}
        <aside className="space-y-6">
          
          {/* Duffel-Style Summary and Edit Search Card */}
          <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card text-ink">
            <h3 className="text-lg font-black tracking-tight">
              {searchParams?.tripType === "round-trip" ? "Round trip" : "One-way"} to {searchParams?.destination || "Destination"}
            </h3>
            <p className="mt-1.5 text-xs font-bold text-ink/50 flex items-center gap-1.5">
              <span className="font-black text-orangebrand">{searchParams?.origin || "Origin"}</span>
              <ArrowRightLeft className="h-3 w-3 text-orangebrand/65" />
              <span className="font-black text-orangebrand">{searchParams?.destination || "Destination"}</span>
              <span>·</span>
              <span className="capitalize">{searchParams?.tripType === "round-trip" ? "Return" : "One-way"}</span>
            </p>
            <p className="mt-1 text-xs font-bold text-ink/50 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-ink/35" />
              <span>
                {formatDateShort(searchParams?.departureDate)}
                {searchParams?.tripType === "round-trip" && searchParams?.returnDate && ` – ${formatDateShort(searchParams.returnDate)}`}
              </span>
              <span>·</span>
              <span>{searchParams?.adults || 1} passenger{Number(searchParams?.adults) > 1 ? "s" : ""}</span>
            </p>
            <p className="mt-1 text-xs font-black text-orangebrand capitalize">{searchParams?.cabinClass || "Economy"}</p>
            
            <button
              onClick={() => setShowSearchWidget(!showSearchWidget)}
              className="mt-5 w-full h-11 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black text-ink/65 hover:border-orangebrand hover:text-orangebrand transition"
            >
              Edit search
            </button>
          </div>

          {/* Sidebar Controls Panel */}
          <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card space-y-6">
            
            {/* Sort By Section */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-ink/40">Sort by</p>
              <div className="mt-3.5 space-y-3">
                {[
                  { key: "least_expensive", label: "Least expensive" },
                  { key: "most_expensive", label: "Most Expensive" },
                  { key: "shortest_duration", label: "Shortest duration" },
                  { key: "longest_duration", label: "Longest duration" }
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer group">
                    <input
                      type="radio"
                      name="sortBy"
                      checked={sortBy === option.key}
                      onChange={() => setSortBy(option.key as "least_expensive" | "most_expensive" | "shortest_duration" | "longest_duration")}
                      className="sr-only"
                    />
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                      sortBy === option.key ? "border-orangebrand bg-orangebrand text-white" : "border-slate-300 bg-white group-hover:border-orangebrand"
                    }`}>
                      {sortBy === option.key && <Check className="h-2.5 w-2.5 stroke-[4px]" />}
                    </span>
                    <span className="select-none">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-orange-50" />

            {/* Stops Section */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-ink/40">Stops</p>
              <div className="mt-3.5 space-y-3">
                {[
                  { key: "direct", label: "Direct only" },
                  { key: "one_stop", label: "1 stop at most" },
                  { key: "two_stops", label: "2 stops at most" },
                  { key: "any", label: "Any number of stops" }
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-3 text-sm font-bold text-ink/75 cursor-pointer group">
                    <input
                      type="radio"
                      name="stops"
                      checked={stopsFilter === option.key}
                      onChange={() => setStopsFilter(option.key as "any" | "direct" | "one_stop" | "two_stops")}
                      className="sr-only"
                    />
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                      stopsFilter === option.key ? "border-orangebrand bg-orangebrand text-white" : "border-slate-300 bg-white group-hover:border-orangebrand"
                    }`}>
                      {stopsFilter === option.key && <Check className="h-2.5 w-2.5 stroke-[4px]" />}
                    </span>
                    <span className="select-none">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-orange-50" />

            {/* Airlines Dropdown Section */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-ink/40">Airlines</label>
              <select
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="mt-3 w-full h-12 rounded-2xl border border-orange-100 bg-cloud px-4 text-sm font-black text-ink focus-ring"
              >
                <option value="all">All airlines</option>
                {airlines.map((airline) => (
                  <option key={airline} value={airline}>
                    {airline}
                  </option>
                ))}
              </select>
            </div>

            <hr className="border-orange-50" />

            {/* Flight Number Search Input */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-ink/40">Flight number</label>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-orangebrand/60" />
                <input
                  type="text"
                  placeholder="e.g. AA0688"
                  value={flightNumberQuery}
                  onChange={(e) => setFlightNumberQuery(e.target.value)}
                  className="w-full h-12 rounded-2xl border border-orange-100 bg-cloud pl-11 pr-4 text-sm font-bold text-ink focus-ring"
                />
              </div>
            </div>

            <hr className="border-orange-50" />

            {/* Flight Time Control Sliders */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-ink/40">Flight time</label>
              
              {/* Take-off slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                  <span className="flex items-center gap-1">
                    <Plane className="h-3.5 w-3.5 text-orangebrand rotate-45" /> Take-off
                  </span>
                  <span className="text-purple-600">at any time</span>
                </div>
                <div className="h-1 bg-slate-200 rounded-full relative my-3">
                  <div className="absolute left-0 right-0 h-1 bg-orangebrand rounded-full" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-orangebrand cursor-grab shadow-sm" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-orangebrand cursor-grab shadow-sm" />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                  <span>00:00</span>
                  <span>08:00</span>
                  <span>16:00</span>
                  <span>23:59</span>
                </div>
              </div>

              {/* Landing slider */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                  <span className="flex items-center gap-1">
                    <Plane className="h-3.5 w-3.5 text-orangebrand rotate-135" /> Landing
                  </span>
                  <span className="text-purple-600">at any time</span>
                </div>
                <div className="h-1 bg-slate-200 rounded-full relative my-3">
                  <div className="absolute left-0 right-0 h-1 bg-orangebrand rounded-full" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-orangebrand cursor-grab shadow-sm" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-orangebrand cursor-grab shadow-sm" />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                  <span>00:00</span>
                  <span>08:00</span>
                  <span>16:00</span>
                  <span>23:59</span>
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* Main Search Results Area */}
        <div className="space-y-6">
          
          {/* Summary Stats Header */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Search reference</p>
              <p className="font-mono text-sm font-semibold text-ink/50 mt-0.5">{offerRequestId}</p>
            </div>
            <p className="rounded-full bg-white px-4 py-2 text-xs font-black text-orangebrand shadow-sm border border-orange-100 tracking-wider">
              {groupedScheduleOffers.uniqueList.length} UNIQUE FLIGHTS AVAILABLE
            </p>
          </div>

          {/* Results Offers Loop */}
          <div className="space-y-6">
            {groupedScheduleOffers.uniqueList.length > 0 ? (
              groupedScheduleOffers.uniqueList.map((offer) => {
                return (
                  <article
                    key={offer.id}
                    className="group flex flex-col rounded-[2.5rem] border border-orange-100 bg-white shadow-card overflow-hidden transition-all duration-300 hover:border-orangebrand/30 hover:shadow-glow"
                  >
                    {/* Top Pricing Header Bar */}
                    <div className="flex items-center justify-between px-6 py-5 bg-orangebrand/[0.03] border-b border-orange-50/50">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-ink/35">Lowest Price</span>
                        <p className="text-2xl font-black text-ink mt-0.5">
                          <span className="text-xs font-bold text-ink/50 mr-1">From</span>
                          {formatCurrency(offer.totalAmount, offer.totalCurrency)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectSchedule(offer)}
                        className="h-11 px-8 rounded-full bg-black text-xs font-black text-white hover:bg-slate-900 transition select-none animate-fadeIn"
                      >
                        Select
                      </button>
                    </div>

                    {/* Slices Content Area */}
                    <div className="p-6 divide-y divide-orange-50/60">
                      {offer.slices.map((slice, sliceIndex) => {
                        const stopsCount = slice.segments.length - 1;
                        const layover = getLayoverDetails(slice);

                        return (
                          <div key={sliceIndex} className="py-6 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            
                            {/* Left: Carrier Logo / Name */}
                            <div className="flex items-center gap-4 min-w-[200px] max-w-[250px]">
                              {offer.ownerIataCode ? (
                                <img
                                  src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${offer.ownerIataCode}.png`}
                                  alt={offer.ownerName}
                                  className="h-9 w-auto max-w-[85px] object-contain shrink-0 filter brightness-95"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orangebrand/10 text-orangebrand">
                                  <Plane className="h-5 w-5" />
                                </span>
                              )}
                              <div className="truncate">
                                <p className="text-xs font-black text-ink truncate">{offer.ownerName}</p>
                                <p className="text-[10px] font-bold text-ink/40 mt-0.5 truncate">
                                  {slice.segments.map(s => s.flightNumber ? `${s.operatingCarrierName !== offer.ownerName ? s.operatingCarrierName : ""} AA${s.flightNumber}`.trim() : "").join(", ")}
                                </p>
                              </div>
                            </div>

                            {/* Middle Left: Timing */}
                            <div className="min-w-[150px]">
                              <p className="text-base font-black text-ink tracking-tight">
                                {new Date(slice.departingAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}{" – "}{new Date(slice.arrivingAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                                {new Date(slice.arrivingAt).getDate() !== new Date(slice.departingAt).getDate() && (
                                  <span className="text-orangebrand text-xs font-black ml-1 select-none font-sans">+1</span>
                                )}
                              </p>
                              <p className="text-[10px] font-bold text-ink/40 uppercase tracking-wider mt-0.5">
                                {formatDateShort(slice.departingAt)} · {new Date(slice.departingAt).toLocaleDateString([], { weekday: "short" })}
                              </p>
                            </div>

                            {/* Middle Right: Duration */}
                            <div className="min-w-[100px]">
                              <p className="text-base font-black text-ink tracking-tight">
                                {formatDurationString(slice.duration)}
                              </p>
                              <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest mt-0.5">
                                {slice.originCode} – {slice.destinationCode}
                              </p>
                            </div>

                            {/* Right: Stops Details */}
                            <div className="min-w-[120px]">
                              <p className="text-base font-black text-ink tracking-tight">
                                {stopsCount === 0 ? "Direct" : `${stopsCount} stop${stopsCount > 1 ? "s" : ""}`}
                              </p>
                              <p className="text-[10px] font-bold text-orangeburnt tracking-tight mt-0.5">
                                {layover ? layover : "non-stop"}
                              </p>
                            </div>

                          </div>
                        );
                      })}
                    </div>

                  </article>
                );
              })
            ) : (
              <div className="rounded-[2rem] bg-white p-12 text-center shadow-card border border-orange-100">
                <p className="text-2xl font-black text-ink">No flights match your filters.</p>
                <p className="mt-2 text-sm text-ink/55">Try relaxing your search options on the sidebar.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
