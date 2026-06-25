import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ChangesPage() {
  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-white p-8 md:p-12 text-ink shadow-card border border-orangebrand/5">
          <p className="text-xs font-black uppercase tracking-widest text-orangebrand">Policies</p>
          <h1 className="mt-3 text-4xl font-black text-ink">Flight Change Policy</h1>
          <p className="mt-2 text-xs font-bold text-ink/40 uppercase">Effective Date: June 25, 2026</p>
          
          <div className="mt-8 space-y-6 text-sm leading-6 text-ink/70 font-semibold">
            <p>
              Please review our policy regarding modifications or itinerary changes for ticketed flight offers.
            </p>
            
            <h2 className="text-lg font-black text-ink pt-2">1. Itinerary Modifications</h2>
            <p>
              Flight date, time, and routing changes depend entirely on the change rules of the specific fare brand you purchased.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>**Non-changeable Fares**: Low/Basic Economy fares generally cannot be changed or re-routed once ticketed.</li>
              <li>**Changeable Fares**: Flexible, Main Cabin, and Business fares typically permit date or time modifications. This may incur carrier change fees plus any fare difference between the original and new flights.</li>
            </ul>

            <h2 className="text-lg font-black text-ink pt-2">2. Processing modifications</h2>
            <p>
              To request a change to your ticketed flight, please email our support desk at <a href="mailto:helloworld@booqdat.com" className="text-orangebrand font-black underline">helloworld@booqdat.com</a> with your booking details and the desired new flight schedule coordinates.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
