"use client";

import { useState, useMemo } from "react";
import { Plane, ArrowRightLeft, Check, Search, Calendar, Briefcase, HelpCircle, ArrowRight } from "lucide-react";
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

export function SearchResultsLayout({ offers, offerRequestId, searchParams, onSelectOffer }: Props) {
  const [showSearchWidget, setShowSearchWidget] = useState(false);
  const [sortBy, setSortBy] = useState<"least_expensive" | "most_expensive" | "shortest_duration" | "longest_duration">("least_expensive");
  const [stopsFilter, setStopsFilter] = useState<"any" | "direct" | "one_stop" | "two_stops">("any");
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [flightNumberQuery, setFlightNumberQuery] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Fare options step state
  const [selectedOfferForFares, setSelectedOfferForFares] = useState<NormalizedFlightOffer | null>(null);
  const [selectedOutboundFare, setSelectedOutboundFare] = useState<"economy_low" | "business_flexible" | "economy_flexible" | null>(null);
  const [selectedInboundFare, setSelectedInboundFare] = useState<"economy_low" | "business_flexible" | "economy_flexible" | null>(null);

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

    // Sort
    result.sort((a, b) => {
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

    return result;
  }, [offers, sortBy, stopsFilter, selectedAirline, flightNumberQuery]);

  // Handle select flight to enter Fare Options step
  function handleSelectFlight(offer: NormalizedFlightOffer) {
    setSelectedOfferForFares(offer);
    setSelectedOutboundFare(null);
    setSelectedInboundFare(null);
  }

  // Handle finalize fare options and proceed to checkout
  async function handleGoToCheckout() {
    if (!selectedOfferForFares) return;
    
    // Calculate custom markup/adjustments based on selected fares if applicable
    const finalOffer = { ...selectedOfferForFares };
    
    const isRoundTrip = searchParams?.tripType === "round-trip";
    const basePrice = parseFloat(selectedOfferForFares.totalAmount);
    
    let totalFareAdjustment = 0;
    
    if (isRoundTrip) {
      if (selectedOutboundFare === "business_flexible") totalFareAdjustment += 150;
      if (selectedOutboundFare === "economy_flexible") totalFareAdjustment += 40;
      
      if (selectedInboundFare === "business_flexible") totalFareAdjustment += 150;
      if (selectedInboundFare === "economy_flexible") totalFareAdjustment += 40;
    } else {
      if (selectedOutboundFare === "business_flexible") totalFareAdjustment += 315;
      if (selectedOutboundFare === "economy_flexible") totalFareAdjustment += 85;
    }
    
    if (totalFareAdjustment > 0) {
      finalOffer.totalAmount = (basePrice + totalFareAdjustment).toFixed(2);
    }

    setSelectingId(finalOffer.id);
    try {
      await onSelectOffer(finalOffer);
    } catch {
      setSelectingId(null);
    }
  }

  // Calculate fare options amounts dynamically
  const farePrices = useMemo(() => {
    if (!selectedOfferForFares) return null;
    const basePrice = parseFloat(selectedOfferForFares.totalAmount);
    const isRoundTrip = searchParams?.tripType === "round-trip";

    if (isRoundTrip) {
      const halfBase = basePrice * 0.5;
      return {
        outbound: {
          economy_low: halfBase,
          business_flexible: halfBase + 150,
          economy_flexible: halfBase + 40
        },
        inbound: {
          economy_low: halfBase,
          business_flexible: halfBase + 150,
          economy_flexible: halfBase + 40
        }
      };
    } else {
      return {
        outbound: {
          economy_low: basePrice,
          business_flexible: basePrice + 315,
          economy_flexible: basePrice + 85
        }
      };
    }
  }, [selectedOfferForFares, searchParams]);

  // Calculate the current active sum total based on selection
  const currentTotalAmount = useMemo(() => {
    if (!selectedOfferForFares || !farePrices) return 0;
    const isRoundTrip = searchParams?.tripType === "round-trip";
    
    let total = 0;
    if (selectedOutboundFare && farePrices.outbound) {
      total += farePrices.outbound[selectedOutboundFare];
    }
    if (isRoundTrip && selectedInboundFare && farePrices.inbound) {
      total += farePrices.inbound[selectedInboundFare];
    }
    return total;
  }, [selectedOfferForFares, farePrices, selectedOutboundFare, selectedInboundFare, searchParams]);

  const isCheckoutActive = useMemo(() => {
    if (!selectedOfferForFares) return false;
    const isRoundTrip = searchParams?.tripType === "round-trip";
    if (isRoundTrip) {
      return selectedOutboundFare !== null && selectedInboundFare !== null;
    }
    return selectedOutboundFare !== null;
  }, [selectedOfferForFares, selectedOutboundFare, selectedInboundFare, searchParams]);

  // --- FARE OPTIONS STEP RENDERING ---
  if (selectedOfferForFares && farePrices) {
    const isRoundTrip = searchParams?.tripType === "round-trip";
    const outboundSlice = selectedOfferForFares.slices[0];
    const inboundSlice = isRoundTrip ? selectedOfferForFares.slices[1] : null;

    return (
      <div className="space-y-6">
        {/* Dynamic Breadcrumbs Nav */}
        <nav className="flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => setSelectedOfferForFares(null)}>Orders</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => setSelectedOfferForFares(null)}>New order</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => setSelectedOfferForFares(null)}>{searchParams?.origin || "Origin"} to {searchParams?.destination || "Destination"}</span>
          {isRoundTrip && (
            <>
              <span>&rsaquo;</span>
              <span className="hover:text-orangebrand transition cursor-pointer" onClick={() => setSelectedOfferForFares(null)}>{searchParams?.destination || "Destination"} to {searchParams?.origin || "Origin"}</span>
            </>
          )}
          <span>&rsaquo;</span>
          <span className="text-ink/65 font-black">Fare options</span>
        </nav>

        {/* Fare Options Grid layout with sidebar */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          
          {/* Slices Fares selection area */}
          <div className="space-y-10">
            
            {/* OUTBOUND SECTION */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-3">
                <span className="text-xs font-black uppercase tracking-widest bg-orangebrand px-3 py-1 text-white rounded-full">Outbound</span>
                <span className="text-xs font-black text-ink/40">{formatDateShort(searchParams?.departureDate)}</span>
              </div>

              {/* Outbound Slice Timings */}
              <div className="flex items-center justify-between bg-cloud rounded-3xl p-5 border border-orange-50/70">
                <div className="flex items-center gap-4">
                  {selectedOfferForFares.ownerIataCode ? (
                    <img
                      src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${selectedOfferForFares.ownerIataCode}.png`}
                      alt={selectedOfferForFares.ownerName}
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

              {/* Outbound Fare Option Cards row */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Economy Low */}
                <div
                  onClick={() => setSelectedOutboundFare("economy_low")}
                  className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                    selectedOutboundFare === "economy_low"
                      ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                      : "border-slate-200 bg-white hover:border-orangebrand/50"
                  }`}
                >
                  <div className="absolute right-4 top-4">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedOutboundFare === "economy_low" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                    }`}>
                      {selectedOutboundFare === "economy_low" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Economy</span>
                    <h4 className="text-base font-black text-ink mt-0.5">Economy Low</h4>
                    <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on changes</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on refunds</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> Hold space</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> Includes carry-on bags</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on checked bags</li>
                    </ul>
                  </div>
                  <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                    <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                    <span className="text-lg font-black text-ink">{formatCurrency(farePrices.outbound.economy_low, selectedOfferForFares.totalCurrency)}</span>
                  </div>
                </div>

                {/* Business Flexible */}
                <div
                  onClick={() => setSelectedOutboundFare("business_flexible")}
                  className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                    selectedOutboundFare === "business_flexible"
                      ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                      : "border-slate-200 bg-white hover:border-orangebrand/50"
                  }`}
                >
                  <div className="absolute right-4 top-4">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedOutboundFare === "business_flexible" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                    }`}>
                      {selectedOutboundFare === "business_flexible" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Business</span>
                    <h4 className="text-base font-black text-ink mt-0.5">Business Flexible</h4>
                    <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Changes allowed</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Refunds allowed</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Hold space</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes carry-on bags</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes checked bags</li>
                    </ul>
                  </div>
                  <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                    <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                    <span className="text-lg font-black text-ink">{formatCurrency(farePrices.outbound.business_flexible, selectedOfferForFares.totalCurrency)}</span>
                  </div>
                </div>

                {/* Economy Flexible */}
                <div
                  onClick={() => setSelectedOutboundFare("economy_flexible")}
                  className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                    selectedOutboundFare === "economy_flexible"
                      ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                      : "border-slate-200 bg-white hover:border-orangebrand/50"
                  }`}
                >
                  <div className="absolute right-4 top-4">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedOutboundFare === "economy_flexible" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                    }`}>
                      {selectedOutboundFare === "economy_flexible" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Economy</span>
                    <h4 className="text-base font-black text-ink mt-0.5">Economy Flexible</h4>
                    <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Changes with fee</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on refunds</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Hold space</li>
                      <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes carry-on bags</li>
                      <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on checked bags</li>
                    </ul>
                  </div>
                  <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                    <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                    <span className="text-lg font-black text-ink">{formatCurrency(farePrices.outbound.economy_flexible, selectedOfferForFares.totalCurrency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* INBOUND SECTION */}
            {isRoundTrip && inboundSlice && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-orange-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-widest bg-orangebrand px-3 py-1 text-white rounded-full">Inbound</span>
                  <span className="text-xs font-black text-ink/40">{formatDateShort(searchParams?.returnDate)}</span>
                </div>

                {/* Inbound Slice Timings */}
                <div className="flex items-center justify-between bg-cloud rounded-3xl p-5 border border-orange-50/70">
                  <div className="flex items-center gap-4">
                    {selectedOfferForFares.ownerIataCode ? (
                      <img
                        src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${selectedOfferForFares.ownerIataCode}.png`}
                        alt={selectedOfferForFares.ownerName}
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

                {/* Inbound Fares conditional rendering */}
                {selectedOutboundFare === null ? (
                  <div className="rounded-3xl bg-slate-50 p-6 border border-slate-100 text-center text-ink/50 text-sm font-black select-none">
                    Choose a fare option for the previous flight to see the available fares for this flight.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3 animate-scaleIn">
                    {/* Economy Low */}
                    <div
                      onClick={() => setSelectedInboundFare("economy_low")}
                      className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                        selectedInboundFare === "economy_low"
                          ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                          : "border-slate-200 bg-white hover:border-orangebrand/50"
                      }`}
                    >
                      <div className="absolute right-4 top-4">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selectedInboundFare === "economy_low" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                        }`}>
                          {selectedInboundFare === "economy_low" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Economy</span>
                        <h4 className="text-base font-black text-ink mt-0.5">Economy Low</h4>
                        <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on changes</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on refunds</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> Hold space</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> Includes carry-on bags</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on checked bags</li>
                        </ul>
                      </div>
                      <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                        <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                        <span className="text-lg font-black text-ink">{formatCurrency(farePrices.inbound?.economy_low ?? 0, selectedOfferForFares.totalCurrency)}</span>
                      </div>
                    </div>

                    {/* Business Flexible */}
                    <div
                      onClick={() => setSelectedInboundFare("business_flexible")}
                      className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                        selectedInboundFare === "business_flexible"
                          ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                          : "border-slate-200 bg-white hover:border-orangebrand/50"
                      }`}
                    >
                      <div className="absolute right-4 top-4">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selectedInboundFare === "business_flexible" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                        }`}>
                          {selectedInboundFare === "business_flexible" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Business</span>
                        <h4 className="text-base font-black text-ink mt-0.5">Business Flexible</h4>
                        <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Changes allowed</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Refunds allowed</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Hold space</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes carry-on bags</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes checked bags</li>
                        </ul>
                      </div>
                      <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                        <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                        <span className="text-lg font-black text-ink">{formatCurrency(farePrices.inbound?.business_flexible ?? 0, selectedOfferForFares.totalCurrency)}</span>
                      </div>
                    </div>

                    {/* Economy Flexible */}
                    <div
                      onClick={() => setSelectedInboundFare("economy_flexible")}
                      className={`relative flex flex-col justify-between rounded-3xl border p-5 cursor-pointer transition duration-200 select-none ${
                        selectedInboundFare === "economy_flexible"
                          ? "border-orangebrand bg-orangebrand/[0.02] ring-2 ring-orangebrand"
                          : "border-slate-200 bg-white hover:border-orangebrand/50"
                      }`}
                    >
                      <div className="absolute right-4 top-4">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selectedInboundFare === "economy_flexible" ? "bg-orangebrand border-orangebrand text-white" : "border-slate-300 bg-white"
                        }`}>
                          {selectedInboundFare === "economy_flexible" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-ink/40">Economy</span>
                        <h4 className="text-base font-black text-ink mt-0.5">Economy Flexible</h4>
                        <ul className="mt-4 space-y-2 text-[11px] font-black text-ink/55">
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Changes with fee</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on refunds</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Hold space</li>
                          <li className="flex items-center gap-1.5"><span className="text-orangebrand">✓</span> Includes carry-on bags</li>
                          <li className="flex items-center gap-1.5"><span className="text-slate-300">➜</span> No data on checked bags</li>
                        </ul>
                      </div>
                      <div className="mt-6 border-t border-slate-50 pt-4 text-right">
                        <span className="text-[10px] font-black text-ink/35 block">total amount from</span>
                        <span className="text-lg font-black text-ink">{formatCurrency(farePrices.inbound?.economy_flexible ?? 0, selectedOfferForFares.totalCurrency)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Summary Sidebar Box */}
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-6 shadow-card text-ink flex flex-col justify-between h-fit">
              <div>
                <h3 className="text-lg font-black tracking-tight border-b border-orange-50 pb-4">Summary</h3>
                <div className="mt-4 space-y-4 text-xs font-black text-ink/65">
                  <p className="flex items-center gap-1.5">
                    Sold by <span className="font-black text-orangebrand">{selectedOfferForFares.ownerName}</span>
                  </p>
                  
                  <ul className="space-y-2 text-[11px] font-bold text-ink/50 border-t border-b border-orange-50/50 py-3">
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> {isCheckoutActive && (selectedOutboundFare === "business_flexible" || selectedInboundFare === "business_flexible") ? "Changes allowed" : "No data on changes"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> {isCheckoutActive && (selectedOutboundFare === "business_flexible" || selectedInboundFare === "business_flexible") ? "Refunds allowed" : "No data on refunds"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> Hold space for 1 day
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> Includes carry-on bags
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-300">➜</span> {(selectedOutboundFare === "business_flexible" || selectedInboundFare === "business_flexible") ? "Includes checked bags" : "No data about checked bags"}
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
                    {isCheckoutActive ? formatCurrency(currentTotalAmount, selectedOfferForFares.totalCurrency) : "—"}
                  </span>
                </div>

                {isCheckoutActive ? (
                  <button
                    onClick={handleGoToCheckout}
                    disabled={selectingId !== null}
                    className="w-full h-12 rounded-2xl bg-black text-xs font-black text-white hover:bg-slate-900 transition flex items-center justify-center gap-2 select-none"
                  >
                    {selectingId ? "Securing booking..." : "Go to checkout"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full h-12 rounded-2xl bg-slate-200 text-xs font-black text-slate-400 cursor-not-allowed flex items-center justify-center gap-2 select-none"
                    >
                      Go to checkout
                    </button>
                    <p className="text-[10px] font-bold text-center text-ink/40">Select fare options for all flights</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedOfferForFares(null)}
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
              {filteredOffers.length} OFFERS AVAILABLE
            </p>
          </div>

          {/* Results Offers Loop */}
          <div className="space-y-6">
            {filteredOffers.length > 0 ? (
              filteredOffers.map((offer) => {
                return (
                  <article
                    key={offer.id}
                    className="group flex flex-col rounded-[2.5rem] border border-orange-100 bg-white shadow-card overflow-hidden transition-all duration-300 hover:border-orangebrand/30 hover:shadow-glow"
                  >
                    {/* Top Pricing Header Bar */}
                    <div className="flex items-center justify-between px-6 py-5 bg-orangebrand/[0.03] border-b border-orange-50/50">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-ink/35">Total Price</span>
                        <p className="text-2xl font-black text-ink mt-0.5">
                          <span className="text-xs font-bold text-ink/50 mr-1">From</span>
                          {formatCurrency(offer.totalAmount, offer.totalCurrency)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectFlight(offer)}
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
