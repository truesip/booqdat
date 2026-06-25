import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { PromoterNav } from "@/components/promoter-dashboard/promoter-nav";

export default async function PromoterLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/promoter/dashboard");
  }
  if (current.user.role !== "promoter") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <PromoterNav />
        <div className="min-w-0 w-full">{children}</div>
      </section>
    </main>
  );
}
