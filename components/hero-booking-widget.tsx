"use client";

import { useState } from "react";
import { CalendarDays, Plane, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { PlaceAutocomplete } from "@/components/flights/place-autocomplete";
import { cn } from "@/lib/utils";

export function HeroBookingWidget() {
  const [tripType, setTripType] = useState<"round-trip" | "one-way">("round-trip");
  
  // Departure sliders states
  const [showDepartureTime, setShowDepartureTime] = useState(false);
  const [takeoffHours, setTakeoffHours] = useState<[number, number]>([0, 24]);
  const [landingHours, setLandingHours] = useState<[number, number]>([0, 24]);

  // Return sliders states
  const [showReturnTime, setShowReturnTime] = useState(false);
  const [returnTakeoffHours, setReturnTakeoffHours] = useState<[number, number]>([0, 24]);
  const [returnLandingHours, setReturnLandingHours] = useState<[number, number]>([0, 24]);

  const tomorrow = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 86400000 * 21).toISOString().slice(0, 10);

  // Dynamic trigger labels
  const departureTimeLabel = takeoffHours[0] === 0 && takeoffHours[1] === 24 && landingHours[0] === 0 && landingHours[1] === 24
    ? "At any time"
    : `Take-off ${String(takeoffHours[0]).padStart(2, "0")}:00 – ${String(takeoffHours[1]).padStart(2, "0")}:00`;

  const returnTimeLabel = returnTakeoffHours[0] === 0 && returnTakeoffHours[1] === 24 && returnLandingHours[0] === 0 && returnLandingHours[1] === 24
    ? "At any time"
    : `Take-off ${String(returnTakeoffHours[0]).padStart(2, "0")}:00 – ${String(returnTakeoffHours[1]).padStart(2, "0")}:00`;

  return (
    <div className="rounded-[1.75rem] border border-orange-200 bg-white p-5 shadow-[0_22px_70px_rgba(124,45,18,0.14)] md:p-6">
      <form action="/flights/search" className="space-y-5">
        <input type="hidden" name="tripType" value={tripType} />
        
        {/* Real time filter inputs submitted in form */}
        <input type="hidden" name="takeoffStart" value={takeoffHours[0]} />
        <input type="hidden" name="takeoffEnd" value={takeoffHours[1]} />
        <input type="hidden" name="landingStart" value={landingHours[0]} />
        <input type="hidden" name="landingEnd" value={landingHours[1]} />
        {tripType === "round-trip" && (
          <>
            <input type="hidden" name="returnTakeoffStart" value={returnTakeoffHours[0]} />
            <input type="hidden" name="returnTakeoffEnd" value={returnTakeoffHours[1]} />
            <input type="hidden" name="returnLandingStart" value={returnLandingHours[0]} />
            <input type="hidden" name="returnLandingEnd" value={returnLandingHours[1]} />
          </>
        )}

        {/* Journey Type Header - Duffel Flow Radio Style */}
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-ink/35 block mb-2.5">Journey type</span>
          <div className="flex flex-wrap items-center gap-6">
            {/* One way */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="journey_type"
                checked={tripType === "one-way"}
                onChange={() => setTripType("one-way")}
                className="sr-only"
              />
              <span className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                tripType === "one-way"
                  ? "border-orangebrand bg-orangebrand text-white shadow-sm"
                  : "border-slate-300 bg-white group-hover:border-orangebrand"
              )}>
                {tripType === "one-way" && (
                  <Check className="h-2.5 w-2.5 stroke-[4px]" />
                )}
              </span>
              <span className="text-xs font-black text-ink select-none uppercase tracking-wide">One way</span>
            </label>

            {/* Return */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="journey_type"
                checked={tripType === "round-trip"}
                onChange={() => setTripType("round-trip")}
                className="sr-only"
              />
              <span className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                tripType === "round-trip"
                  ? "border-orangebrand bg-orangebrand text-white shadow-sm"
                  : "border-slate-300 bg-white group-hover:border-orangebrand"
              )}>
                {tripType === "round-trip" && (
                  <Check className="h-2.5 w-2.5 stroke-[4px]" />
                )}
              </span>
              <span className="text-xs font-black text-ink select-none uppercase tracking-wide">Return</span>
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

          {/* Departure Date Container */}
          <div className="relative">
            <Field label="Departure date">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                <Input name="departureDate" type="date" defaultValue={tomorrow} required className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
              </div>
            </Field>
            <div 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDepartureTime(!showDepartureTime); }}
              className="mt-2.5 inline-flex items-center gap-1.5 border border-purple-200 bg-purple-50/40 text-purple-700 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide hover:bg-purple-50 hover:border-purple-300 transition cursor-pointer select-none"
            >
              <span>{departureTimeLabel}</span>
              <span className="text-[7px]">▼</span>
            </div>

            {/* Departure Time Popover */}
            {showDepartureTime && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 z-50 mt-2 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_20px_55px_rgba(0,0,0,0.14)] w-[320px] select-none text-ink animate-scaleIn"
              >
                <div className="space-y-6">
                  {/* Take-off slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Plane className="h-3.5 w-3.5 text-orangebrand rotate-45" /> Take-off
                      </span>
                      <span className="text-purple-600 font-bold">
                        {takeoffHours[0] === 0 && takeoffHours[1] === 24 
                          ? "at any time" 
                          : `${String(takeoffHours[0]).padStart(2, "0")}:00 – ${String(takeoffHours[1]).padStart(2, "0")}:00`}
                      </span>
                    </div>
                    
                    {/* Draggable Double Range Slider */}
                    <div className="relative h-6 flex items-center">
                      <div className="w-full h-1 bg-slate-200 rounded-full relative">
                        <div 
                          className="absolute h-1 bg-orangebrand rounded-full"
                          style={{
                            left: `${(takeoffHours[0] / 24) * 100}%`,
                            right: `${100 - (takeoffHours[1] / 24) * 100}%`
                          }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="24"
                          value={takeoffHours[0]}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), takeoffHours[1] - 1);
                            setTakeoffHours([val, takeoffHours[1]]);
                          }}
                          className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                        />
                        <input
                          type="range"
                          min="0"
                          max="24"
                          value={takeoffHours[1]}
                          onChange={(e) => {
                            const val = Math.max(Number(e.target.value), takeoffHours[0] + 1);
                            setTakeoffHours([takeoffHours[0], val]);
                          }}
                          className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                        />
                        <div 
                          className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                          style={{ left: `${(takeoffHours[0] / 24) * 100}%` }}
                        />
                        <div 
                          className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                          style={{ left: `${(takeoffHours[1] / 24) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                      <span>00:00</span>
                      <span>08:00</span>
                      <span>16:00</span>
                      <span>23:59</span>
                    </div>
                  </div>

                  {/* Landing slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Plane className="h-3.5 w-3.5 text-orangebrand rotate-135" /> Landing
                      </span>
                      <span className="text-purple-600 font-bold">
                        {landingHours[0] === 0 && landingHours[1] === 24 
                          ? "at any time" 
                          : `${String(landingHours[0]).padStart(2, "0")}:00 – ${String(landingHours[1]).padStart(2, "0")}:00`}
                      </span>
                    </div>
                    
                    <div className="relative h-6 flex items-center">
                      <div className="w-full h-1 bg-slate-200 rounded-full relative">
                        <div 
                          className="absolute h-1 bg-orangebrand rounded-full"
                          style={{
                            left: `${(landingHours[0] / 24) * 100}%`,
                            right: `${100 - (landingHours[1] / 24) * 100}%`
                          }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="24"
                          value={landingHours[0]}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), landingHours[1] - 1);
                            setLandingHours([val, landingHours[1]]);
                          }}
                          className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                        />
                        <input
                          type="range"
                          min="0"
                          max="24"
                          value={landingHours[1]}
                          onChange={(e) => {
                            const val = Math.max(Number(e.target.value), landingHours[0] + 1);
                            setLandingHours([landingHours[0], val]);
                          }}
                          className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                        />
                        <div 
                          className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                          style={{ left: `${(landingHours[0] / 24) * 100}%` }}
                        />
                        <div 
                          className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                          style={{ left: `${(landingHours[1] / 24) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                      <span>00:00</span>
                      <span>08:00</span>
                      <span>16:00</span>
                      <span>23:59</span>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDepartureTime(false)}
                      className="px-5 py-2.5 rounded-xl bg-black text-xs font-black text-white hover:bg-slate-900 transition"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Return Date Container */}
          {tripType === "round-trip" ? (
            <div className="relative">
              <Field label="Return date">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orangebrand" />
                  <Input name="returnDate" type="date" defaultValue={nextWeek} className="h-16 rounded-[1.1rem] border-orange-100 pl-12 font-bold" />
                </div>
              </Field>
              <div 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReturnTime(!showReturnTime); }}
                className="mt-2.5 inline-flex items-center gap-1.5 border border-purple-200 bg-purple-50/40 text-purple-700 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide hover:bg-purple-50 hover:border-purple-300 transition cursor-pointer select-none"
              >
                <span>{returnTimeLabel}</span>
                <span className="text-[7px]">▼</span>
              </div>

              {/* Return Time Popover */}
              {showReturnTime && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 z-50 mt-2 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_20px_55px_rgba(0,0,0,0.14)] w-[320px] select-none text-ink animate-scaleIn"
                >
                  <div className="space-y-6">
                    {/* Take-off slider */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Plane className="h-3.5 w-3.5 text-orangebrand rotate-45" /> Take-off
                        </span>
                        <span className="text-purple-600 font-bold">
                          {returnTakeoffHours[0] === 0 && returnTakeoffHours[1] === 24 
                            ? "at any time" 
                            : `${String(returnTakeoffHours[0]).padStart(2, "0")}:00 – ${String(returnTakeoffHours[1]).padStart(2, "0")}:00`}
                        </span>
                      </div>
                      
                      <div className="relative h-6 flex items-center">
                        <div className="w-full h-1 bg-slate-200 rounded-full relative">
                          <div 
                            className="absolute h-1 bg-orangebrand rounded-full"
                            style={{
                              left: `${(returnTakeoffHours[0] / 24) * 100}%`,
                              right: `${100 - (returnTakeoffHours[1] / 24) * 100}%`
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={returnTakeoffHours[0]}
                            onChange={(e) => {
                              const val = Math.min(Number(e.target.value), returnTakeoffHours[1] - 1);
                              setReturnTakeoffHours([val, returnTakeoffHours[1]]);
                            }}
                            className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                          />
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={returnTakeoffHours[1]}
                            onChange={(e) => {
                              const val = Math.max(Number(e.target.value), returnTakeoffHours[0] + 1);
                              setReturnTakeoffHours([returnTakeoffHours[0], val]);
                            }}
                            className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                          />
                          <div 
                            className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                            style={{ left: `${(returnTakeoffHours[0] / 24) * 100}%` }}
                          />
                          <div 
                            className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                            style={{ left: `${(returnTakeoffHours[1] / 24) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                        <span>00:00</span>
                        <span>08:00</span>
                        <span>16:00</span>
                        <span>23:59</span>
                      </div>
                    </div>

                    {/* Landing slider */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-black text-ink/75 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Plane className="h-3.5 w-3.5 text-orangebrand rotate-135" /> Landing
                        </span>
                        <span className="text-purple-600 font-bold">
                          {returnLandingHours[0] === 0 && returnLandingHours[1] === 24 
                            ? "at any time" 
                            : `${String(returnLandingHours[0]).padStart(2, "0")}:00 – ${String(returnLandingHours[1]).padStart(2, "0")}:00`}
                        </span>
                      </div>
                      
                      <div className="relative h-6 flex items-center">
                        <div className="w-full h-1 bg-slate-200 rounded-full relative">
                          <div 
                            className="absolute h-1 bg-orangebrand rounded-full"
                            style={{
                              left: `${(returnLandingHours[0] / 24) * 100}%`,
                              right: `${100 - (returnLandingHours[1] / 24) * 100}%`
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={returnLandingHours[0]}
                            onChange={(e) => {
                              const val = Math.min(Number(e.target.value), returnLandingHours[1] - 1);
                              setReturnLandingHours([val, returnLandingHours[1]]);
                            }}
                            className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                          />
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={returnLandingHours[1]}
                            onChange={(e) => {
                              const val = Math.max(Number(e.target.value), returnLandingHours[0] + 1);
                              setReturnLandingHours([returnLandingHours[0], val]);
                            }}
                            className="absolute w-full h-4 opacity-0 pointer-events-auto cursor-pointer left-0 top-1/2 -translate-y-1/2 z-30"
                          />
                          <div 
                            className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                            style={{ left: `${(returnLandingHours[0] / 24) * 100}%` }}
                          />
                          <div 
                            className="absolute h-4 w-4 rounded-full bg-white border-2 border-orangebrand shadow-md -ml-2 -mt-1.5 pointer-events-none z-20"
                            style={{ left: `${(returnLandingHours[1] / 24) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-[9px] font-bold text-ink/35 px-1 mt-1">
                        <span>00:00</span>
                        <span>08:00</span>
                        <span>16:00</span>
                        <span>23:59</span>
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReturnTime(false)}
                        className="px-5 py-2.5 rounded-xl bg-black text-xs font-black text-white hover:bg-slate-900 transition"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="opacity-45 pointer-events-none relative">
              <Field label="Return date">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                  <Input disabled name="returnDate" type="text" placeholder="DD / MM / YYYY" className="h-16 rounded-[1.1rem] border-slate-100 bg-slate-50 pl-12 font-bold" />
                </div>
              </Field>
              <div className="mt-2.5 inline-flex items-center gap-1.5 border border-slate-200 bg-slate-50 text-slate-400 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide select-none">
                <span>{returnTimeLabel}</span>
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

        <div className="mt-6 pt-2">
          <Button className="h-16 w-full text-base bg-black text-white hover:bg-black/90 font-black rounded-2xl border-none">
            Find available flights
          </Button>
        </div>
      </form>
    </div>
  );
}
