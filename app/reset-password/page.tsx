import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { asString } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = asString(params?.token);

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Reset links expire quickly and can only be used once."
      footer={<Link href="/login" className="font-bold text-ocean">Back to sign in</Link>}
    >
      {token ? <ResetPasswordForm token={token} /> : <p className="text-center text-sm text-coral">Missing reset token.</p>}
    </AuthCard>
  );
}
