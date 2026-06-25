import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-white p-8 md:p-12 text-ink shadow-card border border-orangebrand/5">
          <p className="text-xs font-black uppercase tracking-widest text-orangebrand">Policies</p>
          <h1 className="mt-3 text-4xl font-black text-ink">Terms of Service</h1>
          <p className="mt-2 text-xs font-bold text-ink/40 uppercase">Effective Date: June 25, 2026</p>
          
          <div className="mt-8 space-y-6 text-sm leading-6 text-ink/70 font-semibold">
            <p>
              Welcome to BooqDat. These Terms of Service (&quot;Terms&quot;) govern your use of the website and flight booking service operated by BOOQDAT USA LLC.
            </p>
            
            <h2 className="text-lg font-black text-ink pt-2">1. Booking Services</h2>
            <p>
              BooqDat acts as a search, discovery, and booking interface connecting customers to third-party airlines via the Duffel API. Once your flight is confirmed, your reservation is subject to the specific terms and carriage rules of the operating carrier.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">2. Pricing and Platform Markup</h2>
            <p>
              All listed totals include the actual flight base fare, applicable carrier taxes/fees, and any BooqDat service markup or platform booking fee. The full total breakdown is prominently shown before confirming your purchase.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">3. User Responsibility</h2>
            <p>
              You are solely responsible for ensuring that all traveler details (including legal given names, passport numbers, birth dates, and genders) entered during checkout match the official passenger travel documents exactly. Any typographical errors may lead to carrier cancellation or boarding rejection.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">4. Contact Information</h2>
            <p>
              For legal inquiries or dispute alerts, please contact our general counsel at <a href="mailto:helloworld@booqdat.com" className="text-orangebrand font-black underline">helloworld@booqdat.com</a>.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
