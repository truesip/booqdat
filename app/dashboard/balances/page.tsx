import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BalancesClient } from "@/components/dashboard/balances-client";

export default async function BalancesPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/dashboard/balances");
  }

  if (current.user.role !== "promoter") {
    redirect("/dashboard");
  }

  const companyId = current.profile?.whopCompanyId;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Promoter dashboard</p>
        <h1 className="mt-3 text-4xl font-black">Balances</h1>
        <p className="mt-3 max-w-2xl text-ink/65 font-medium">
          View your Whop connected company balance, request payouts, and track past withdrawals.
        </p>
      </section>

      <section className="rounded-[2rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card">
        {companyId ? (
          <BalancesClient companyId={companyId} />
        ) : (
          <div className="text-center py-8">
            <p className="text-ink/65 mb-6 font-medium">{"You don't have a Whop Connected Account set up yet. Complete your onboarding to start receiving payouts."}</p>
            <a
              href="/api/promoter/onboarding"
              className="inline-block rounded-2xl bg-orangebrand px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-orangebrand/90"
            >
              Start Whop Onboarding
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
