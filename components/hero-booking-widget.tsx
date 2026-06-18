"use client";

import { useState } from "react";
import { ArrowRightLeft, BedDouble, CalendarDays, Car, Plane, Search, Ticket, UsersRound } from "lucide-react";
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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-orange-50 p-1 text-sm font-black text-ink/60">
              <button
                type="button"
                onClick={() => setTripType("round-trip")}
                className={cn("rounded-full px-4 py-2 transition", tripType === "round-trip" ? "bg-orangebrand text-white" : "hover:text-orangeburnt")}
              >
                Round trip
              </button>
              <button
                type="button"
                onClick={() => setTripType("one-way")}
                className={cn("rounded-full px-4 py-2 transition", tripType === "one-way" ? "bg-orangebrand text-white" : "hover:text-orangeburnt")}
              >
                One way
              </button>
            </div>
            <p className="text-sm font-semibold text-ink/55">Search fares, compare options, checkout securely.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-3">
              <PlaceAutocomplete
                label="Leaving from"
                name="origin"
                defaultCode="ATL"
                defaultLabel="Atlanta"
              />
            </div>
            <div className="relative xl:col-span-3">
              <PlaceAutocomplete
                label="Going to"
                name="destination"
                defaultCode="LAX"
                defaultLabel="Los Angeles"
                iconRotate={true}
              />
              <span className="absolute -left-5 top-10 hidden h-10 w-10 items-center justify-center rounded-full border border-orange-100 bg-white text-orangebrand shadow-sm xl:flex">
                <ArrowRightLeft className="h-4 w-4" />
              </span>
            </div>
            <div className="xl:col-span-2">
              <Field label="Departure">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                  <Input name="departureDate" type="date" defaultValue={tomorrow} required className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                </div>
              </Field>
            </div>
            {tripType === "round-trip" ? (
              <div className="xl:col-span-2">
                <Field label="Return">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                    <Input name="returnDate" type="date" defaultValue={nextWeek} className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                  </div>
                </Field>
              </div>
            ) : null}
            <div>
              <Field label="Travelers">
                <div className="relative">
                  <UsersRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                  <Input name="adults" type="number" min={1} max={9} defaultValue={1} required className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                </div>
              </Field>
            </div>
            <div>
              <Field label="Cabin">
                <Select name="cabinClass" defaultValue="economy" className="h-16 rounded-[1.1rem] border-orange-100 font-bold">
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </Select>
              </Field>
            </div>
          </div>
          <div className="mt-5">
            <Button className="h-16 w-full text-base">
              <Search className="mr-2 h-5 w-5" /> Search flights
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
