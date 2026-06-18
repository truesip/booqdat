import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your BooqDat account"
      subtitle="Save your profile, track purchased orders, and prepare for saved payment method previews."
      footer={
        <>
          Already registered? <Link href="/login" className="font-bold text-ocean">Sign in</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
