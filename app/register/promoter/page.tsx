import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { PromoterRegisterForm } from "@/components/auth/promoter-register-form";

export default function PromoterRegisterPage() {
  return (
    <AuthCard
      title="Create your Promoter account"
      subtitle="Become a BooqDat promoter, manage live events, and sell tickets securely."
      footer={
        <>
          Already registered? <Link href="/login" className="font-bold text-ocean">Sign in</Link>
          <br />
          Want to buy tickets instead? <Link href="/register" className="font-bold text-ocean">Customer sign up</Link>
        </>
      }
    >
      <PromoterRegisterForm />
    </AuthCard>
  );
}
