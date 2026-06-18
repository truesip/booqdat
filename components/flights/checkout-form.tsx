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

  if (checkoutSession?.sessionId && !checkoutSession.sessionId.startsWith("ch_mock_")) {
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

  if (checkoutSession?.purchaseUrl) {
    return (
      <div className="rounded-[2rem] bg-white p-6 shadow-card">
        <h2 className="text-2xl font-black">Test payment session ready</h2>
        <p className="mt-2 text-sm text-ink/60">
          Continue to the booking status page to review payment and ticketing behavior.
        </p>
        <Button onClick={() => router.push(checkoutSession.purchaseUrl ?? `/booking/${bookingId}/status`)} className="mt-6 w-full">
          Continue to payment status
        </Button>
      </div>
    );
  }

  return (
    <form action={submitPassenger} className="rounded-[2rem] bg-white p-6 shadow-card">
      <h2 className="text-2xl font-black">Passenger and contact details</h2>
      <p className="mt-2 text-sm text-ink/60">
        Final charge: {formatCurrency(booking.amount, booking.currency)} including BooqDat service fee.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <Select name="title" defaultValue="mr">
            <option value="mr">Mr</option>
            <option value="mrs">Mrs</option>
            <option value="ms">Ms</option>
            <option value="mx">Mx</option>
          </Select>
        </Field>
        <Field label="Gender">
          <Select name="gender" defaultValue="m">
            <option value="m">Male</option>
            <option value="f">Female</option>
            <option value="x">Unspecified</option>
          </Select>
        </Field>
        <Field label="First name">
          <Input name="givenName" required />
        </Field>
        <Field label="Last name">
          <Input name="familyName" required />
        </Field>
        <Field label="Date of birth">
          <Input name="bornOn" type="date" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={booking.contact.email === "pending@booqdat.local" ? "" : booking.contact.email} required />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={booking.contact.phone ?? ""} required />
        </Field>
      </div>
      <Button disabled={loading} className="mt-6 w-full">
        {loading ? "Preparing payment..." : "Continue to secure payment"}
      </Button>
    </form>
  );
}
