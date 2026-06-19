"use client";

import { useState } from "react";
import { ArrowRightLeft, BedDouble, CalendarDays, Car, Plane, Search, Ticket, UsersRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { PlaceAutocomplete } from "@/components/flights/place-autocomplete";
import { cn } from "@/lib/utils";

const verticals = [
  { key: "flights", label: "Flights", icon: Plane, enabled: true },
  { key: "hotels", label: "Hotels", icon: BedDouble, enabled: false },
  { key: "cars", label: "Cars", icon: Car, enabled: false },
  { key: "events", label: "Events", icon: Ticket, enabled: false }
] as const;

export function HeroBookingWidget() {
  const [active, setActive] = useState("flights");
  const [tripType, setTripType] = useState<"round-trip" | "one-way">("round-trip");
  const tomorrow = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 86400000 * 21).toISOString().slice(0, 10);

  return (
    <div className="rounded-[1.75rem] border border-orange-200 bg-white p-4 shadow-[0_22px_70px_rgba(124,45,18,0.16)] sm:p-5">
      <div className="grid grid-cols-4 gap-2 rounded-[1.35rem] bg-orange-50 p-1">
        {verticals.map((vertical) => {
          const Icon = vertical.icon;
          return (
            <button
              key={vertical.key}
              type="button"
              onClick={() => setActive(vertical.key)}
              className={cn(
                "rounded-[1.35rem] px-3 py-3 text-sm font-black transition",
                active === vertical.key ? "bg-orangebrand text-white shadow-sm" : "bg-white text-ink/65 hover:text-orangeburnt"
              )}
            >
              <Icon className="mx-auto mb-1 h-4 w-4" />
              {vertical.label}
            </button>
          );
        })}
      </div>

      {active === "flights" ? (
        <form action="/flights/search" className="mt-5">
          <input type="hidden" name="tripType" value={tripType} />
          
          {/* Journey Type Header - Duffel Flow Radio Style */}
          <div className="mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-ink/40 block mb-3">Journey type</span>
            <div className="flex flex-wrap items-center gap-6">
              {/* One way */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="journey_type"
                  checked={tripType === "one-way"}
                  onChange={() => setTripType("one-way")}
                  className="sr-only"
                />
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                  tripType === "one-way"
                    ? "border-orangebrand bg-orangebrand text-white shadow-sm"
                    : "border-slate-300 bg-white group-hover:border-orangebrand"
                )}>
                  {tripType === "one-way" && (
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  )}
                </span>
                <span className="text-sm font-black text-ink select-none">One way</span>
              </label>

              {/* Return */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="journey_type"
                  checked={tripType === "round-trip"}
                  onChange={() => setTripType("round-trip")}
                  className="sr-only"
                />
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                  tripType === "round-trip"
                    ? "border-orangebrand bg-orangebrand text-white shadow-sm"
                    : "border-slate-300 bg-white group-hover:border-orangebrand"
                )}>
                  {tripType === "round-trip" && (
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  )}
                </span>
                <span className="text-sm font-black text-ink select-none">Return</span>
              </label>

              {/* Multi-city */}
              <label className="flex items-center gap-2.5 cursor-not-allowed opacity-45">
                <input
                  type="radio"
                  name="journey_type"
                  disabled
                  className="sr-only"
                />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                </span>
                <span className="text-sm font-black text-slate-400 select-none">Multi-city</span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Origin & Destination */}
            <div className="relative">
              <PlaceAutocomplete
                label="Origin"
                name="origin"
                defaultCode="ATL"
                defaultLabel="Atlanta"
                placeholder="Origin"
              />
            </div>
            <div className="relative">
              <PlaceAutocomplete
                label="Destination"
                name="destination"
                defaultCode="LAX"
                defaultLabel="Los Angeles"
                iconRotate={true}
                placeholder="Destination"
              />
            </div>

            {/* Departure & Return Dates */}
            <div>
              <Field label="Departure date">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                  <Input name="departureDate" type="date" defaultValue={tomorrow} required className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                </div>
              </Field>
              <div className="mt-1.5 flex items-center gap-1 pl-1 text-[11px] font-black tracking-wide text-indigo-600 hover:text-indigo-800 transition cursor-pointer select-none">
                <span>At any time</span>
                <span className="text-[7px]">▼</span>
              </div>
            </div>

            {tripType === "round-trip" ? (
              <div>
                <Field label="Return date">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                    <Input name="returnDate" type="date" defaultValue={nextWeek} className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                  </div>
                </Field>
                <div className="mt-1.5 flex items-center gap-1 pl-1 text-[11px] font-black tracking-wide text-indigo-600 hover:text-indigo-800 transition cursor-pointer select-none">
                  <span>At any time</span>
                  <span className="text-[7px]">▼</span>
                </div>
              </div>
            ) : (
              <div className="opacity-45 pointer-events-none">
                <Field label="Return date">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                    <Input disabled name="returnDate" type="text" placeholder="DD / MM / YYYY" className="h-16 rounded-[1.1rem] border-slate-100 bg-slate-50 pl-12 font-bold" />
                  </div>
                </Field>
                <div className="mt-1.5 flex items-center gap-1 pl-1 text-[11px] font-black tracking-wide text-slate-400 select-none">
                  <span>At any time</span>
                  <span className="text-[7px]">▼</span>
                </div>
              </div>
            )}

            {/* Passengers & Cabin Class Dropdowns */}
            <div>
              <Field label="Passengers">
                <Select name="adults" className="h-16 rounded-[1.1rem] border-orange-100 font-bold">
                  <option value="1">1 adult</option>
                  <option value="2">2 adults</option>
                  <option value="3">3 adults</option>
                  <option value="4">4 adults</option>
                  <option value="5">5 adults</option>
                  <option value="6">6 adults</option>
                  <option value="7">7 adults</option>
                  <option value="8">8 adults</option>
                  <option value="9">9 adults</option>
                </Select>
              </Field>
            </div>

            <div>
              <Field label="Class">
                <Select name="cabinClass" defaultValue="economy" className="h-16 rounded-[1.1rem] border-orange-100 font-bold">
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                  <option value="any">Any</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <Button className="h-16 w-full text-base bg-black text-white hover:bg-black/90 font-black rounded-2xl border-none">
              Find available flights
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-5 rounded-3xl bg-orange-50 p-6 text-ink ring-1 ring-orange-100">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-orangeburnt">Coming soon</p>
          <h3 className="mt-2 text-2xl font-black">BooqDat {verticals.find((item) => item.key === active)?.label} is almost ready.</h3>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Join the waitlist to get early access when this travel vertical opens.
          </p>
          <form action="/api/waitlist" method="post" className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="vertical" value={active === "hotels" ? "hotels" : active === "cars" ? "cars" : "events"} />
            <Input name="email" type="email" placeholder="you@example.com" required />
            <Button type="submit">Notify me</Button>
          </form>
        </div>
      )}
    </div>
  );
}
