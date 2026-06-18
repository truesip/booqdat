"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/user/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.resetUrl ? `Development reset link: ${data.resetUrl}` : "If that email exists, a reset link will be sent.");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Account email">
        <Input name="email" type="email" required />
      </Field>
      <Button>Send reset link</Button>
      {message ? <p className="rounded-2xl bg-aqua/10 p-3 text-sm font-semibold text-ocean">{message}</p> : null}
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/user/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") })
    });

    if (!response.ok) {
      setMessage("Reset link is invalid or expired.");
      return;
    }

    router.push("/login?reset=success");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="New password">
        <Input name="password" type="password" minLength={8} required />
      </Field>
      <Button>Reset password</Button>
      {message ? <p className="rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-coral">{message}</p> : null}
    </form>
  );
}
