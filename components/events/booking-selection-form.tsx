"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Calendar, MapPin, Ticket, ShieldAlert } from "lucide-react";

interface EventData {
  _id: string;
  title: string;
  description: string;
  category?: string;
  date: string;
  time?: string;
  venue?: string;
  city: string;
  state?: string;
  country?: string;
  gaPrice: number;
  gaQty: number;
  vipPrice?: number;
  vipQty?: number;
  banner?: string;
}

export function BookingSelectionForm({ event }: { event: EventData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ticketType, setTicketType] = useState<"ga" | "vip">("ga");
  const [quantity, setQuantity] = useState(1);

  const selectedPrice = ticketType === "vip" ? (event.vipPrice || event.gaPrice) : event.gaPrice;
  const subtotal = selectedPrice * quantity;
  const serviceFee = 5.00;
  const total = subtotal + serviceFee;

  async function handleProceed() {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical: "events",
          eventId: event._id,
          ticketType,
          quantity
        })
      });

      if (!res.ok) {
        throw new Error("Failed to create booking");
      }

      const data = await res.json();
      router.push(`/events/checkout/${data.bookingId}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
      {/* Left side: Event Info & Imagery */}
      <div className="space-y-6">
        <div className="relative h-64 w-full rounded-3xl overflow-hidden bg-slate-100">
          {event.banner ? (
            <Image
              src={event.banner}
              alt={event.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-100 text-orangebrand text-3xl font-black">
              {event.title.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase text-orangebrand">
            {event.category || "General"}
          </span>
          <h1 className="mt-3 text-3xl font-black text-ink">{event.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/75">{event.description}</p>
        </div>

        <div className="space-y-3.5 border-t border-slate-50 pt-5 text-sm font-semibold text-ink/65">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-orangebrand shrink-0" />
            <span>{formattedDate} {event.time ? `at ${event.time}` : ""}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-orangebrand shrink-0" />
            <span>{event.venue}, {event.city}, {event.state || ""}</span>
          </div>
        </div>
      </div>

      {/* Right side: Form Selection & Price Overview */}
      <div className="flex flex-col justify-between rounded-3xl bg-cloud p-6 border border-orange-50/60">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-orange-100/60">
            <Ticket className="h-5 w-5 text-orangebrand" />
            <h2 className="text-lg font-black text-ink">Ticket Configuration</h2>
          </div>

          <Field label="Select Ticket Type">
            <Select
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as "ga" | "vip")}
            >
              <option value="ga">General Admission - {formatCurrency(event.gaPrice, "USD")}</option>
              {event.vipPrice && (
                <option value="vip">VIP Pass - {formatCurrency(event.vipPrice, "USD")}</option>
              )}
            </Select>
          </Field>

          <Field label="Quantity">
            <Select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((q) => (
                <option key={q} value={q}>
                  {q} Ticket{q > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </Field>

          {/* Checkout Total Payment Overview */}
          <div className="space-y-4 pt-4 border-t border-orange-100/60 text-ink">
            <h3 className="font-black text-sm uppercase tracking-wider text-ink/40">Pricing Breakdown</h3>
            <div className="space-y-2.5 text-sm font-semibold">
              <div className="flex justify-between text-ink/75">
                <span>
                  {ticketType === "vip" ? "VIP" : "GA"} Ticket ({quantity}x)
                </span>
                <span>{formatCurrency(subtotal, "USD")}</span>
              </div>
              <div className="flex justify-between text-ink/75">
                <span>BooqDat platform fee</span>
                <span>{formatCurrency(serviceFee, "USD")}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-orange-100/60 text-base font-black">
              <span>Total Price</span>
              <span className="text-orangebrand text-lg">{formatCurrency(total, "USD")}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex gap-2 p-3 bg-white/70 rounded-2xl border border-orange-100/50 text-xs text-ink/60">
            <ShieldAlert className="h-4.5 w-4.5 text-orangebrand shrink-0 mt-0.5" />
            <p>Tickets are held for 10 minutes upon proceeding to the secure checkout session.</p>
          </div>

          <Button
            onClick={handleProceed}
            disabled={loading}
            className="w-full h-14 bg-black text-white hover:bg-slate-900 font-black text-sm rounded-2xl"
          >
            {loading ? "Holding tickets..." : "Proceed to Checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
