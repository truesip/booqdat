"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle, Calendar, Users, Mail, Phone, Plane, Ticket } from "lucide-react";
import type { BookingDocument } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface StatusTrackerProps {
  bookingId: string;
  initialBooking: BookingDocument;
}

export function StatusTracker({ bookingId, initialBooking }: StatusTrackerProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDocument>(initialBooking);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const status = booking.status;
  const paymentStatus = booking.paymentStatus;

  const isTerminalState =
    status === "confirmed" ||
    status === "payment_failed" ||
    status === "ticketing_failed" ||
    status === "requires_manual_review" ||
    status === "cancelled" ||
    status === "refunded";

  useEffect(() => {
    if (isTerminalState) {
      if (status === "confirmed") {
        setIsRedirecting(true);
        const timer = setTimeout(() => {
          router.push(`/booking/${bookingId}/confirmed`);
        }, 2000);
        return () => clearTimeout(timer);
      }
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.booking) {
          setBooking(data.booking);
        }
      } catch (err) {
        console.error("Error polling booking status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [bookingId, isTerminalState, status, router]);

  // Stage determinations
  let stage1: "pending" | "loading" | "success" | "failed" = "pending";
  let stage2: "pending" | "loading" | "success" | "failed" = "pending";
  let stage3: "pending" | "loading" | "success" | "failed" = "pending";

  // Stage 1: Payment Verification
  if (paymentStatus === "succeeded" || ["payment_succeeded", "ticketing_in_progress", "confirmed"].includes(status)) {
    stage1 = "success";
  } else if (paymentStatus === "failed" || status === "payment_failed") {
    stage1 = "failed";
  } else {
    stage1 = "loading";
  }

  // Stage 2: Airline Ticket Issuance
  if (status === "confirmed") {
    stage2 = "success";
  } else if (status === "ticketing_failed" || status === "requires_manual_review") {
    stage2 = "failed";
  } else if (stage1 === "success" && (status === "payment_succeeded" || status === "ticketing_in_progress")) {
    stage2 = "loading";
  }

  // Stage 3: Complete
  if (status === "confirmed") {
    stage3 = "success";
  } else if (stage2 === "failed") {
    stage3 = "failed";
  }

  const getStatusBadgeClass = () => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "payment_failed":
      case "ticketing_failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "requires_manual_review":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "payment_succeeded":
      case "ticketing_in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "confirmed":
        return "Booking Confirmed";
      case "ticketing_failed":
        return "Ticketing Unsuccessful";
      case "requires_manual_review":
        return "Pending Manual Verification";
      case "payment_failed":
        return "Payment Failed";
      case "payment_succeeded":
        return "Payment Received";
      case "ticketing_in_progress":
        return "Securing Seats & Tickets";
      default:
        return status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Progress Tracking Card */}
      <section className="rounded-[2rem] bg-white p-8 shadow-card border border-orangebrand/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-orange-50 pb-6 mb-8">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-orangebrand">Real-time tracker</span>
            <h1 className="text-2xl font-black text-ink mt-1">Securing your journey...</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-ink/40">Status:</span>
            <div className={`px-4 py-1.5 rounded-full text-xs font-black border uppercase tracking-wider ${getStatusBadgeClass()}`}>
              {getStatusText()}
            </div>
          </div>
        </div>

        {/* Steps Tracker Layout */}
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-cloud shadow-sm transition-all duration-300">
              {stage1 === "success" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-green-500 text-white animate-scaleIn">
                  <Check className="h-6 w-6 stroke-[3px]" />
                </div>
              )}
              {stage1 === "loading" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-orangebrand text-white animate-spin">
                  <Loader2 className="h-6 w-6" />
                </div>
              )}
              {stage1 === "failed" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-red-500 text-white">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              )}
            </div>
            <h3 className="mt-4 text-base font-black text-ink">1. Secure Payment</h3>
            <p className="mt-1 text-xs font-semibold text-ink/50 max-w-[200px]">
              {stage1 === "success" && "Whop checkout completed successfully."}
              {stage1 === "loading" && "Awaiting Whop payment verification..."}
              {stage1 === "failed" && "Whop payment attempt failed."}
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-cloud shadow-sm transition-all duration-300">
              {stage2 === "success" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-green-500 text-white animate-scaleIn">
                  <Check className="h-6 w-6 stroke-[3px]" />
                </div>
              )}
              {stage2 === "loading" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-orangebrand text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {stage2 === "failed" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-red-500 text-white">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              )}
              {stage2 === "pending" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold">2</div>
              )}
            </div>
            <h3 className="mt-4 text-base font-black text-ink">2. Ticket Issuance</h3>
            <p className="mt-1 text-xs font-semibold text-ink/50 max-w-[200px]">
              {stage2 === "success" && "Carrier ticketing secured successfully."}
              {stage2 === "loading" && "Issuing ticket with carrier via Duffel..."}
              {stage2 === "failed" && "Failed to automatically issue ticket."}
              {stage2 === "pending" && "Awaiting verified checkout completion."}
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-cloud shadow-sm transition-all duration-300">
              {stage3 === "success" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-green-500 text-white animate-scaleIn">
                  <Check className="h-6 w-6 stroke-[3px]" />
                </div>
              )}
              {stage3 === "failed" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-red-500 text-white">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              )}
              {stage3 === "pending" && stage2 === "loading" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold animate-pulse">3</div>
              )}
              {stage3 === "pending" && stage2 !== "loading" && (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold">3</div>
              )}
            </div>
            <h3 className="mt-4 text-base font-black text-ink">3. Flight Confirmed</h3>
            <p className="mt-1 text-xs font-semibold text-ink/50 max-w-[200px]">
              {stage3 === "success" && "E-Ticket issued! Redirecting..."}
              {stage3 === "failed" && "Order requires manual assistance."}
              {stage3 === "pending" && "Ready to complete order."}
            </p>
          </div>
        </div>

        {/* Dynamic Warning and Status Messages */}
        {status === "requires_manual_review" && (
          <div className="mt-8 rounded-3xl bg-amber-50 p-6 border border-amber-200">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-black text-amber-900">Your payment succeeded but ticketing is pending</h4>
                <p className="text-sm font-semibold text-amber-700 mt-1">
                  Don&apos;t worry! Your payment of {formatCurrency(booking.amount, booking.currency)} has been received. Our team has been notified and is manually finalizing your ticket with the carrier right now.
                </p>
                <p className="text-sm font-semibold text-amber-700 mt-2">
                  No action is needed on your part. Your booking reference will be sent to <span className="font-bold">{booking.contact.email}</span> shortly. If you have questions, reach out to <a href="mailto:helloworld@booqdat.com" className="underline font-bold">helloworld@booqdat.com</a>.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "ticketing_failed" && (
          <div className="mt-8 rounded-3xl bg-red-50 p-6 border border-red-200">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-black text-red-900">Ticketing attempt was unsuccessful</h4>
                <p className="text-sm font-semibold text-red-700 mt-1">
                  We encountered an issue creating your ticket with the airline. This can happen if flight availability or prices changed during checkout.
                </p>
                <p className="text-sm font-semibold text-red-700 mt-2">
                  {booking.failureReason && <span className="block font-mono bg-white p-3 rounded-2xl border border-red-100 mb-3 text-red-600 text-xs font-bold">{booking.failureReason}</span>}
                  Our operations desk is investigating this immediately to issue a manual ticket or trigger a full refund. Please contact us at <a href="mailto:helloworld@booqdat.com" className="underline font-bold">helloworld@booqdat.com</a> with your booking ID: <span className="font-mono font-bold text-ink bg-white px-2 py-0.5 rounded-md text-xs">{bookingId}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "payment_failed" && (
          <div className="mt-8 rounded-3xl bg-red-50 p-6 border border-red-200">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-black text-red-900">Payment failed or cancelled</h4>
                <p className="text-sm font-semibold text-red-700 mt-1">
                  Your Whop transaction could not be completed successfully. No funds have been captured.
                </p>
                <p className="text-sm font-semibold text-red-700 mt-2">
                  Please return to the search or retry passenger checkout to complete your booking.
                </p>
              </div>
            </div>
          </div>
        )}

        {isRedirecting && (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl bg-green-50 p-4 border border-green-200 text-green-800 text-sm font-black animate-pulse">
            <Check className="h-5 w-5" />
            Flight successfully ticketed! Loading your confirmation page...
          </div>
        )}
      </section>

      {/* Flight Itinerary Summary Card */}
      <section className="rounded-[2rem] bg-white p-8 shadow-card border border-orangebrand/5">
        <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6">
          <Plane className="h-5 w-5 text-orangebrand" />
          Flight details
        </h2>

        {booking.offerSnapshot.slices.map((slice, sIdx) => (
          <div key={sIdx} className="mb-6 last:mb-0 bg-cloud rounded-3xl p-5 border border-orange-100">
            <div className="flex items-center justify-between border-b border-orange-100/50 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orangebrand px-3 py-1 text-xs font-black text-white">
                  {sIdx === 0 ? "Outbound" : "Return"}
                </span>
                <span className="text-xs font-bold text-ink/50">
                  {slice.segments[0]?.operatingCarrierName ?? booking.offerSnapshot.ownerName}
                </span>
              </div>
              <span className="text-xs font-black text-ink/70">
                Duration: {slice.duration ? slice.duration.replace("PT", "").toLowerCase() : "N/A"}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Departure */}
              <div>
                <p className="text-2xl font-black text-ink">{slice.originCode}</p>
                <p className="text-xs font-semibold text-ink/50 mt-0.5">{slice.originName}</p>
                <p className="text-xs font-bold text-orangebrand mt-1">{formatDateTime(slice.departingAt)}</p>
              </div>

              {/* Path line */}
              <div className="hidden md:flex flex-col items-center flex-1 max-w-[120px] px-2">
                <span className="text-[10px] font-black text-ink/40 uppercase tracking-wider">
                  {slice.segments.length > 1 ? `${slice.segments.length - 1} stop` : "non-stop"}
                </span>
                <div className="w-full h-0.5 bg-orangebrand/25 relative my-2">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orangebrand" />
                </div>
                <span className="text-[10px] font-bold text-ink/30">
                  {slice.segments[0]?.flightNumber ? `Flight ${slice.segments[0].flightNumber}` : ""}
                </span>
              </div>

              {/* Arrival */}
              <div className="md:text-right">
                <p className="text-2xl font-black text-ink">{slice.destinationCode}</p>
                <p className="text-xs font-semibold text-ink/50 mt-0.5">{slice.destinationName}</p>
                <p className="text-xs font-bold text-orangebrand mt-1">{formatDateTime(slice.arrivingAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Passenger Details Summary Card */}
      <section className="rounded-[2rem] bg-white p-8 shadow-card border border-orangebrand/5">
        <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6">
          <Users className="h-5 w-5 text-orangebrand" />
          Passenger information
        </h2>

        <div className="space-y-4">
          {booking.passengers.map((passenger, pIdx) => (
            <div key={passenger.id ?? pIdx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-cloud rounded-2xl border border-orange-50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orangebrand">Adult {pIdx + 1}</span>
                <p className="font-black text-ink mt-0.5">
                  {passenger.title ? passenger.title.charAt(0).toUpperCase() + passenger.title.slice(1) : ""} {passenger.givenName} {passenger.familyName}
                </p>
                <p className="text-xs font-semibold text-ink/50 mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Born: {new Date(passenger.bornOn).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="mt-3 md:mt-0 text-xs font-bold text-ink/60 bg-white border border-orange-100/50 px-3 py-1.5 rounded-xl">
                Gender: {passenger.gender === "m" ? "Male" : passenger.gender === "f" ? "Female" : "Unspecified"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact & Payment Summary Card */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[2rem] bg-white p-8 shadow-card border border-orangebrand/5">
          <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-orangebrand" />
            Contact details
          </h2>
          <div className="space-y-3 mt-4 text-sm font-semibold">
            <div className="flex items-center gap-2 text-ink/75">
              <Mail className="h-4 w-4 text-ink/35" />
              <span>{booking.contact.email}</span>
            </div>
            {booking.contact.phone && (
              <div className="flex items-center gap-2 text-ink/75">
                <Phone className="h-4 w-4 text-ink/35" />
                <span>{booking.contact.phone}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-8 shadow-card border border-orangebrand/5">
          <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-4">
            <Ticket className="h-5 w-5 text-orangebrand" />
            Payment summary
          </h2>
          <div className="space-y-3 mt-4 text-sm font-semibold">
            <div className="flex justify-between items-center text-ink/65">
              <span>Flight base & tax</span>
              <span>{formatCurrency(booking.amount - booking.serviceFeeAmount, booking.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-ink/65">
              <span>BooqDat service fee</span>
              <span>{formatCurrency(booking.serviceFeeAmount, booking.currency)}</span>
            </div>
            <hr className="border-orange-50 my-2" />
            <div className="flex justify-between items-center text-base font-black text-ink">
              <span>Total charged</span>
              <span className="text-orangebrand">{formatCurrency(booking.amount, booking.currency)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}