"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SecurityForm({ email }: { email: string }) {
  const [message, setMessage] = useState("");

  async function requestReset() {
    const response = await fetch("/api/user/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.resetUrl ? `Development reset link: ${data.resetUrl}` : "Password reset email requested.");
  }

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-card">
      <h1 className="text-3xl font-black">Security</h1>
      <p className="mt-2 text-sm leading-6 text-ink/60">
        Request a secure, expiring reset link. Passwords are hashed and never displayed.
      </p>
      <Button onClick={requestReset} className="mt-6">
        Send password reset link
      </Button>
      {message ? <p className="mt-4 rounded-2xl bg-aqua/10 p-3 text-sm font-semibold text-ocean">{message}</p> : null}
    </div>
  );
}
