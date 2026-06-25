/* eslint-disable @next/next/no-img-element */
"use client";

import { Plane, Clock, ArrowRightLeft, ShieldCheck, HelpCircle } from "lucide-react";
import type { NormalizedFlightOffer } from "@/lib/types";

interface SelectedFlightsTimelineProps {
  offer: NormalizedFlightOffer;
  tripType?: "one-way" | "round-trip";
}

function formatDurationString(duration?: string) {
  if (!duration) return "N/A";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration.replace("PT", "").toLowerCase();
  const hrs = match[1] ? `${match[1]}h` : "";
  const mins = match[2] ? `${match[2]}m` : "";
  return `${hrs} ${mins}`.trim() || "0m";
}

type Segment = NormalizedFlightOffer["slices"][0]["segments"][0];

function getLayoverDetails(seg0: Segment, seg1: Segment) {
  const diffMs = new Date(seg1.departingAt).getTime() - new Date(seg0.arrivingAt).getTime();
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins}m layover`;
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function SelectedFlightsTimeline({ offer, tripType = "round-trip" }: SelectedFlightsTimelineProps) {
  const isRoundTrip = tripType === "round-trip";
  const outboundSlice = offer.slices[0];
  const inboundSlice = isRoundTrip ? offer.slices[1] : null;

  return (
    <div className="space-y-8">
      {/* Header Info Panel */}
      <div className="border-b border-orange-50 pb-6 mb-6">
        {/* Badges bar */}
        <div className="flex flex-wrap gap-2 mb-4 select-none">
          <span className="rounded-full bg-orangebrand px-3 py-1 text-[10px] font-black uppercase text-white tracking-widest">
            {isRoundTrip ? "Return" : "One-way"}
          </span>
          <span className="rounded-full bg-cloud px-3 py-1 text-[10px] font-black uppercase text-ink/50 tracking-wider">
            {formatDateShort(outboundSlice.departingAt)}
            {isRoundTrip && inboundSlice && ` – ${formatDateShort(inboundSlice.departingAt)}`}
          </span>
          <span className="rounded-full bg-cloud px-3 py-1 text-[10px] font-black uppercase text-ink/50 tracking-wider">
            1 Passenger
          </span>
          <span className="rounded-full bg-cloud px-3 py-1 text-[10px] font-black uppercase text-ink/50 tracking-wider capitalize">
            Economy
          </span>
        </div>

        <h1 className="text-3xl font-black text-ink tracking-tight flex items-center gap-3">
          <span>{outboundSlice.originCode}</span>
          <ArrowRightLeft className="h-5 w-5 text-orangebrand" />
          <span>{outboundSlice.destinationCode}</span>
        </h1>
        <p className="mt-2 text-xs font-bold text-ink/40">
          This offer will expire on {new Date(offer.expiresAt || Date.now() + 600000).toLocaleString()}
        </p>
      </div>

      <h2 className="text-xl font-black text-ink border-b border-orange-50 pb-3">Selected flights</h2>

      {/* OUTBOUND SLICE */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-orangebrand/[0.02] p-5 rounded-3xl border border-orangebrand/10">
          <div className="flex items-center gap-4">
            {offer.ownerIataCode ? (
              <img
                src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${offer.ownerIataCode}.png`}
                alt={offer.ownerName}
                className="h-9 w-auto max-w-[85px] object-contain filter brightness-95"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand"><Plane className="h-4.5 w-4.5" /></span>
            )}
            <div>
              <p className="text-xs font-black text-ink/40 uppercase tracking-wider">Outbound</p>
              <p className="text-sm font-black text-ink mt-0.5">{formatDateShort(outboundSlice.departingAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs font-black text-ink/65">
            <div>
              <p className="text-[10px] uppercase text-ink/40">Duration</p>
              <p className="mt-0.5">{formatDurationString(outboundSlice.duration)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ink/40">Stops</p>
              <p className="mt-0.5">{outboundSlice.segments.length - 1 === 0 ? "Non-stop" : `${outboundSlice.segments.length - 1} stop`}</p>
            </div>
          </div>
        </div>

        {/* Outbound Segments Timeline */}
        <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-4">
          {outboundSlice.segments.map((segment, sIdx) => {
            const hasLayover = sIdx < outboundSlice.segments.length - 1;
            const nextSegment = hasLayover ? outboundSlice.segments[sIdx + 1] : null;

            return (
              <div key={sIdx} className="space-y-6 relative">
                {/* Node marker 1 */}
                <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-orangebrand bg-white" />
                
                {/* Segment Departure */}
                <div>
                  <p className="text-sm font-black text-ink">
                    {new Date(segment.departingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <span className="font-bold text-ink/60">Depart from {segment.originCode}</span>
                  </p>
                  <p className="text-xs font-semibold text-ink/50 mt-0.5">Local airport departure coordinates.</p>
                </div>

                {/* Flight Info Connect line details */}
                <div className="rounded-2xl bg-cloud p-4 border border-orange-50 text-[11px] font-black text-ink/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Flight duration: {formatDurationString(segment.duration)}</span>
                    <span className="text-orangebrand uppercase">{segment.marketingCarrierName || offer.ownerName}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink/45">
                    <span>ECONOMY</span>
                    <span>Boeing 737-800</span>
                    <span>Flight {segment.flightNumber || "AA1400"}</span>
                    <span>1 carry-on bag</span>
                    <span>1 checked bag</span>
                  </div>
                </div>

                {/* Node marker 2 */}
                <div className="absolute -left-[31px] bottom-1 h-3.5 w-3.5 rounded-full border-2 border-orangebrand bg-white" />

                {/* Segment Arrival */}
                <div className="pt-2">
                  <p className="text-sm font-black text-ink">
                    {new Date(segment.arrivingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <span className="font-bold text-ink/60">Arrive at {segment.destinationCode}</span>
                  </p>
                  <p className="text-xs font-semibold text-ink/50 mt-0.5">Local airport arrival coordinates.</p>
                </div>

                {/* Layover bar */}
                {hasLayover && nextSegment && (
                  <div className="relative -left-6 py-2 px-4 my-4 bg-purple-50 text-purple-700 text-xs font-black rounded-xl border border-purple-100 flex items-center gap-1.5 animate-fadeIn">
                    <Clock className="h-3.5 w-3.5 text-purple-600" />
                    <span>{getLayoverDetails(segment, nextSegment)} in {segment.destinationCode}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Outbound Slice Policy Box */}
        <div className="rounded-2xl bg-green-50/50 border border-green-100 p-5 text-green-800 text-xs font-bold leading-relaxed space-y-1">
          <p className="font-black text-green-900 flex items-center gap-1.5">
            <span className="text-lg">✓</span> Flight change policy
          </p>
          <p className="text-green-700 pl-5">Make changes to this flight up until the departure date (no penalty).</p>
        </div>
      </div>

      {/* INBOUND SLICE */}
      {isRoundTrip && inboundSlice && (
        <div className="space-y-6 pt-6 border-t border-orange-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-orangebrand/[0.02] p-5 rounded-3xl border border-orangebrand/10">
            <div className="flex items-center gap-4">
              {offer.ownerIataCode ? (
                <img
                  src={`https://assets.duffel.com/img/airlines/for-light-background/medium/${offer.ownerIataCode}.png`}
                  alt={offer.ownerName}
                  className="h-9 w-auto max-w-[85px] object-contain filter brightness-95"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand"><Plane className="h-4.5 w-4.5" /></span>
              )}
              <div>
                <p className="text-xs font-black text-ink/40 uppercase tracking-wider">Inbound</p>
                <p className="text-sm font-black text-ink mt-0.5">{formatDateShort(inboundSlice.departingAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs font-black text-ink/65">
              <div>
                <p className="text-[10px] uppercase text-ink/40">Duration</p>
                <p className="mt-0.5">{formatDurationString(inboundSlice.duration)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-ink/40">Stops</p>
                <p className="mt-0.5">{inboundSlice.segments.length - 1 === 0 ? "Non-stop" : `${inboundSlice.segments.length - 1} stop`}</p>
              </div>
            </div>
          </div>

          {/* Inbound Segments Timeline */}
          <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-4">
            {inboundSlice.segments.map((segment, sIdx) => {
              const hasLayover = sIdx < inboundSlice.segments.length - 1;
              const nextSegment = hasLayover ? inboundSlice.segments[sIdx + 1] : null;

              return (
                <div key={sIdx} className="space-y-6 relative">
                  {/* Node marker 1 */}
                  <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-orangebrand bg-white" />
                  
                  {/* Segment Departure */}
                  <div>
                    <p className="text-sm font-black text-ink">
                      {new Date(segment.departingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      <span className="font-bold text-ink/60">Depart from {segment.originCode}</span>
                    </p>
                    <p className="text-xs font-semibold text-ink/50 mt-0.5">Local airport departure coordinates.</p>
                  </div>

                  {/* Flight Info Connect line details */}
                  <div className="rounded-2xl bg-cloud p-4 border border-orange-50 text-[11px] font-black text-ink/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Flight duration: {formatDurationString(segment.duration)}</span>
                      <span className="text-orangebrand uppercase">{segment.marketingCarrierName || offer.ownerName}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink/45">
                      <span>ECONOMY</span>
                      <span>Boeing 737-800</span>
                      <span>Flight {segment.flightNumber || "AA1400"}</span>
                      <span>1 carry-on bag</span>
                      <span>1 checked bag</span>
                    </div>
                  </div>

                  {/* Node marker 2 */}
                  <div className="absolute -left-[31px] bottom-1 h-3.5 w-3.5 rounded-full border-2 border-orangebrand bg-white" />

                  {/* Segment Arrival */}
                  <div className="pt-2">
                    <p className="text-sm font-black text-ink">
                      {new Date(segment.arrivingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      <span className="font-bold text-ink/60">Arrive at {segment.destinationCode}</span>
                    </p>
                    <p className="text-xs font-semibold text-ink/50 mt-0.5">Local airport arrival coordinates.</p>
                  </div>

                  {/* Layover bar */}
                  {hasLayover && nextSegment && (
                    <div className="relative -left-6 py-2 px-4 my-4 bg-purple-50 text-purple-700 text-xs font-black rounded-xl border border-purple-100 flex items-center gap-1.5 animate-fadeIn">
                      <Clock className="h-3.5 w-3.5 text-purple-600" />
                      <span>{getLayoverDetails(segment, nextSegment)} in {segment.destinationCode}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inbound Slice Policy Box */}
          <div className="rounded-2xl bg-green-50/50 border border-green-100 p-5 text-green-800 text-xs font-bold leading-relaxed space-y-1">
            <p className="font-black text-green-900 flex items-center gap-1.5">
              <span className="text-lg">✓</span> Flight change policy
            </p>
            <p className="text-green-700 pl-5">Make changes to this flight up until the departure date (no penalty).</p>
          </div>
        </div>
      )}

      {/* Global Order Policies */}
      <div className="grid gap-4 md:grid-cols-2 pt-6 border-t border-slate-150">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-slate-700 text-xs font-bold leading-relaxed">
          <p className="font-black text-slate-800 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="h-4.5 w-4.5 text-orangebrand" /> Order change policy
          </p>
          <p className="text-slate-500 pl-6">Make changes to this order up until the initial departure date (no penalty).</p>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-slate-700 text-xs font-bold leading-relaxed">
          <p className="font-black text-slate-800 flex items-center gap-1.5 mb-1">
            <HelpCircle className="h-4.5 w-4.5 text-orangebrand" /> Order refund policy
          </p>
          <p className="text-slate-500 pl-6">This order is not refundable.</p>
        </div>
      </div>
    </div>
  );
}
