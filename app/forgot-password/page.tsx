import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and BooqDat will create a secure reset link."
      footer={<Link href="/login" className="font-bold text-ocean">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
