"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Leaf, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { NormalizedFlightOffer } from "@/lib/types";

export function OfferCard({ offer }: { offer: NormalizedFlightOffer }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const firstSlice = offer.slices[0];
  const lastSlice = offer.slices[offer.slices.length - 1];

  async function selectOffer() {
    setLoading(true);
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer })
    });

    if (!response.ok) {
      setLoading(false);
      alert("Unable to start checkout. Please refresh the offer and try again.");
      return;
    }

    const data = (await response.json()) as { bookingId: string };
    router.push(`/flights/checkout/${data.bookingId}`);
  }

  return (
    <article className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orangeburnt">
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-xl font-black">{offer.ownerName}</h3>
              <p className="text-sm text-ink/55">Operated by {offer.slices[0]?.segments[0]?.operatingCarrierName ?? offer.ownerName}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-ink/65 sm:grid-cols-2">
            <p>
              <span className="font-bold text-ink">{firstSlice?.originCode}</span> to{" "}
              <span className="font-bold text-ink">{firstSlice?.destinationCode}</span>
            </p>
            <p>{formatDateTime(firstSlice?.departingAt)}</p>
            {lastSlice && offer.slices.length > 1 ? (
              <>
                <p>
                  <span className="font-bold text-ink">{lastSlice.originCode}</span> to{" "}
                  <span className="font-bold text-ink">{lastSlice.destinationCode}</span>
                </p>
                <p>{formatDateTime(lastSlice.departingAt)}</p>
              </>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orangeburnt">
              <Clock className="mr-1 h-3 w-3" /> Expires {offer.expiresAt ? formatDateTime(offer.expiresAt) : "soon"}
            </span>
            {offer.totalEmissionsKg ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Leaf className="mr-1 h-3 w-3" /> {offer.totalEmissionsKg} kg CO₂
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-3xl bg-cloud p-5 md:min-w-56">
          <p className="text-sm font-semibold text-ink/55">Total flight price</p>
          <p className="mt-1 text-3xl font-black">{formatCurrency(offer.totalAmount, offer.totalCurrency)}</p>
          <p className="mt-1 text-xs text-ink/50">Service fee shown at checkout</p>
          <Button onClick={selectOffer} disabled={loading} className="mt-5 w-full">
            {loading ? "Starting checkout..." : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
