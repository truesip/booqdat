import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to track BooqDat orders, profile details, and payment method previews."
      footer={
        <>
          No account? <Link href="/register" className="font-bold text-ocean">Create one</Link>
          <br />
          <Link href="/forgot-password" className="font-bold text-ocean">Forgot password?</Link>
        </>
      }
    >
      <Suspense fallback={<div className="rounded-2xl bg-cloud p-4 text-sm font-semibold text-ink/60">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
