"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type ProfilePayload = {
  email: string;
  fullName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  dateOfBirth?: string;
};

export function ProfileForm({ profile }: { profile: ProfilePayload }) {
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Profile saved." : "Unable to save profile.");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] bg-white p-6 shadow-card">
      <h1 className="text-3xl font-black">Profile</h1>
      <p className="mt-2 text-sm text-ink/60">Manage the information BooqDat uses for your account and booking defaults.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <Input name="fullName" defaultValue={profile.fullName ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={profile.email} required />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} />
        </Field>
        <Field label="Date of birth">
          <Input name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth ?? ""} />
        </Field>
        <Field label="Address line 1">
          <Input name="addressLine1" defaultValue={profile.addressLine1 ?? ""} />
        </Field>
        <Field label="Address line 2">
          <Input name="addressLine2" defaultValue={profile.addressLine2 ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={profile.city ?? ""} />
        </Field>
        <Field label="State">
          <Input name="state" defaultValue={profile.state ?? ""} />
        </Field>
        <Field label="Postal code">
          <Input name="postalCode" defaultValue={profile.postalCode ?? ""} />
        </Field>
        <Field label="Country">
          <Input name="country" defaultValue={profile.country ?? ""} />
        </Field>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <Button>Save profile</Button>
        {message ? <p className="text-sm font-bold text-ocean">{message}</p> : null}
      </div>
    </form>
  );
}
