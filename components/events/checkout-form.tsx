"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { BookingDocument } from "@/lib/types";

export function CheckoutForm({ bookingId, booking }: { bookingId: string; booking: BookingDocument }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<{
    sessionId?: string;
    purchaseUrl?: string;
    environment?: "production" | "sandbox";
  } | null>(null);

  const quantity = booking.eventSnapshot?.quantity || 1;

  async function submitPassenger(formData: FormData) {
    setLoading(true);

    const contactEmail = String(formData.get("email") ?? "");
    const contactPhone = String(formData.get("phone") ?? "");

    const passengers = [];
    for (let i = 0; i < quantity; i++) {
      passengers.push({
        type: "adult",
        title: String(formData.get(`title_${i}`) ?? "mr"),
        givenName: String(formData.get(`givenName_${i}`) ?? ""),
        familyName: String(formData.get(`familyName_${i}`) ?? ""),
        bornOn: String(formData.get(`bornOn_${i}`) ?? ""),
        gender: String(formData.get(`gender_${i}`) ?? "m"),
        email: contactEmail,
        phoneNumber: contactPhone
      });
    }

    const payload = {
      contact: {
        email: contactEmail,
        phone: contactPhone
      },
      passengers
    };

    try {
      const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!bookingResponse.ok) {
        setLoading(false);
        alert("Please check passenger details and try again.");
        return;
      }

      const checkoutResponse = await fetch("/api/payments/whop/checkout-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId })
      });

      if (!checkoutResponse.ok) {
        setLoading(false);
        alert("Unable to create payment session. Please try again.");
        return;
      }

      const checkout = (await checkoutResponse.json()) as {
        sessionId?: string;
        purchaseUrl?: string;
        environment?: "production" | "sandbox";
      };
      setCheckoutSession(checkout);
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Calculate pricing breakdown aligning with flights structure
  const platformFee = booking.serviceFeeAmount || 0;
  const baseTicketAmount = booking.amount - platformFee;
  const taxAmount = parseFloat((baseTicketAmount * 0.10).toFixed(2)); // 10% entertainment tax
  const fareBaseAmount = parseFloat((baseTicketAmount - taxAmount).toFixed(2));

  if (checkoutSession?.sessionId) {
    return (
      <div className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
        <h2 className="text-2xl font-black">Secure checkout</h2>
        <p className="mt-2 text-sm text-ink/60">Complete payment securely without leaving BooqDat.</p>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <WhopCheckoutEmbed
            sessionId={checkoutSession.sessionId}
            returnUrl={`${window.location.origin}/booking/${bookingId}/status`}
            environment={checkoutSession.environment ?? (process.env.NEXT_PUBLIC_WHOP_CHECKOUT_ENVIRONMENT === "production" ? "production" : "sandbox")}
            theme="light"
            themeOptions={{
              accentColor: "orange",
              borderRadius: 18,
              backgroundColor: "#ffffff"
            }}
            onComplete={() => router.push(`/booking/${bookingId}/status`)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={submitPassenger} className="space-y-6">
        {/* Contact Details Section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
          <h2 className="text-xl font-black text-ink">Contact details</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Email *">
              <Input name="email" type="email" defaultValue={booking.contact.email === "pending@booqdat.local" ? "" : booking.contact.email} required />
            </Field>
            <Field label="Phone number *">
              <Input name="phone" type="tel" defaultValue={booking.contact.phone ?? ""} required placeholder="+1 617 756 2626" />
            </Field>
          </div>
        </section>

        {/* Guests Details Section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-6">
          <h2 className="text-xl font-black text-ink">Guest Passenger Details</h2>
          
          {Array.from({ length: quantity }).map((_, index) => (
            <div key={index} className="space-y-6 border-b border-orange-50 pb-6 last:border-none last:pb-0">
              <div className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orangebrand">
                Guest {index + 1}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Title *">
                  <Select name={`title_${index}`} defaultValue="mr">
                    <option value="mr">Mr.</option>
                    <option value="mrs">Mrs.</option>
                    <option value="ms">Ms.</option>
                    <option value="mx">Mx.</option>
                  </Select>
                </Field>
                <Field label="Given name *">
                  <Input name={`givenName_${index}`} required />
                </Field>
                <Field label="Family name *">
                  <Input name={`familyName_${index}`} required />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date of birth *">
                  <Input name={`bornOn_${index}`} type="date" required />
                </Field>
                <Field label="Gender *">
                  <Select name={`gender_${index}`} defaultValue="m">
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                    <option value="x">Unspecified</option>
                  </Select>
                </Field>
              </div>
            </div>
          ))}
        </section>

        {/* Checkout Payment Overview Aligning with Flights Structure */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-4 text-ink">
          <h2 className="text-xl font-black">Payment Overview</h2>
          
          <div className="space-y-3 mt-4 text-sm font-semibold border-b border-slate-50 pb-4">
            <div className="flex justify-between items-center text-ink/65">
              <span>Ticket Base Fare</span>
              <span>{formatCurrency(fareBaseAmount, booking.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-ink/65">
              <span>Entertainment Taxes (10%)</span>
              <span>{formatCurrency(taxAmount, booking.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-ink/65">
              <span>BooqDat platform fee</span>
              <span>{formatCurrency(platformFee, booking.currency)}</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-lg font-black pt-2">
            <span>Total (USD)</span>
            <span className="text-orangebrand">{formatCurrency(booking.amount, booking.currency)}</span>
          </div>
        </section>

        <Button disabled={loading} className="h-16 w-full text-base bg-black text-white hover:bg-slate-900 rounded-2xl font-black">
          {loading ? "Preparing payment..." : "Pay with Balance"}
        </Button>
      </form>
    </div>
  );
}
