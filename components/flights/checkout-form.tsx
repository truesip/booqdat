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

  async function submitPassenger(formData: FormData) {
    setLoading(true);
    const payload = {
      contact: {
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "")
      },
      passengers: [
        {
          type: "adult",
          title: String(formData.get("title") ?? "mr"),
          givenName: String(formData.get("givenName") ?? ""),
          familyName: String(formData.get("familyName") ?? ""),
          bornOn: String(formData.get("bornOn") ?? ""),
          gender: String(formData.get("gender") ?? "m"),
          email: String(formData.get("email") ?? ""),
          phoneNumber: String(formData.get("phone") ?? "")
        }
      ]
    };

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
    setLoading(false);
  }

  if (checkoutSession?.sessionId) {
    return (
      <div className="rounded-[2rem] bg-white p-6 shadow-card">
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
    <form action={submitPassenger} className="space-y-6">
      {/* Contact Details Section */}
      <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
        <h2 className="text-2xl font-black text-ink">Contact details</h2>
        <p className="mt-1 text-sm text-ink/50">For receipt and carrier travel updates.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Email address *">
            <Input name="email" type="email" defaultValue={booking.contact.email === "pending@booqdat.local" ? "" : booking.contact.email} required />
          </Field>
          <Field label="Phone number *">
            <Input name="phone" type="tel" defaultValue={booking.contact.phone ?? ""} required placeholder="+1 617 756 2626" />
          </Field>
        </div>
      </section>

      {/* Passenger Personal & Passport Details */}
      <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
        <h2 className="text-2xl font-black text-ink">Passengers</h2>
        <div className="mt-3 inline-flex rounded-full bg-orangebrand/10 px-3 py-1 text-xs font-black text-orangebrand">
          Adult 1
        </div>

        <div className="mt-6 space-y-6">
          {/* Personal Details Subsection */}
          <div>
            <h3 className="text-base font-black text-ink/70">Personal details</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Title *">
                <Select name="title" defaultValue="mr">
                  <option value="mr">Mr.</option>
                  <option value="mrs">Mrs.</option>
                  <option value="ms">Ms.</option>
                  <option value="mx">Mx.</option>
                </Select>
              </Field>
              <Field label="Given name *">
                <Input name="givenName" required />
              </Field>
              <Field label="Family name *">
                <Input name="familyName" required />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Date of birth *">
                <Input name="bornOn" type="date" required />
              </Field>
              <Field label="Gender *">
                <Select name="gender" defaultValue="m">
                  <option value="m">Male</option>
                  <option value="f">Female</option>
                  <option value="x">Unspecified</option>
                </Select>
              </Field>
            </div>
          </div>

          <hr className="border-orange-50" />

          {/* Passport Details Subsection */}
          <div>
            <h3 className="text-base font-black text-ink/70">Passport details</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Country of issue">
                <Select name="passportCountry" defaultValue="US">
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                </Select>
              </Field>
              <Field label="Passport number">
                <Input name="passportNumber" placeholder="L12345678" />
              </Field>
              <Field label="Expiry date">
                <Input name="passportExpiry" type="date" />
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* Add Extras Section */}
      <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-4">
        <h2 className="text-2xl font-black text-ink">Add extras</h2>
        
        {/* Baggage */}
        <div className="flex items-center justify-between rounded-3xl bg-cloud p-5 border border-orange-100">
          <div>
            <p className="font-black text-ink">Extra baggage</p>
            <p className="text-xs font-semibold text-ink/55 mt-0.5">Add any extra baggage you need for your trip</p>
          </div>
          <span className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-black text-ink/45">
            Not available
          </span>
        </div>

        {/* Seat Selection */}
        <div className="flex items-center justify-between rounded-3xl bg-cloud p-5 border border-orange-100">
          <div>
            <p className="font-black text-ink">Seat selection</p>
            <p className="text-xs font-semibold text-ink/55 mt-0.5">Specify where on the plane you&apos;d like to sit</p>
          </div>
          <span className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-black text-ink/45">
            Not available
          </span>
        </div>
      </section>

      <Button disabled={loading} className="h-16 w-full text-base">
        {loading ? "Preparing payment..." : "Continue to secure payment"}
      </Button>
    </form>
  );
}
