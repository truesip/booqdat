import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-white p-8 md:p-12 text-ink shadow-card border border-orangebrand/5">
          <p className="text-xs font-black uppercase tracking-widest text-orangebrand">Policies</p>
          <h1 className="mt-3 text-4xl font-black text-ink">Refund Policy</h1>
          <p className="mt-2 text-xs font-bold text-ink/40 uppercase">Effective Date: June 25, 2026</p>
          
          <div className="mt-8 space-y-6 text-sm leading-6 text-ink/70 font-semibold">
            <p>
              At BOOQDAT USA LLC, we aim to provide a transparent and clear booking experience. Please review our policy on refunds and cancellations carefully.
            </p>
            
            <h2 className="text-lg font-black text-ink pt-2">1. Refundability Rules</h2>
            <p>
              Whether your ticket is refundable depends entirely on the specific fare brand and ticket class you selected during booking (for example, *Business Flexible* vs. *Economy Low*).
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>**Basic/Low Economy Fares**: Generally non-refundable as mandated by carrier regulations.</li>
              <li>**Flexible/Business Fares**: May be eligible for refunds, occasionally subject to carrier-imposed administration fees.</li>
            </ul>

            <h2 className="text-lg font-black text-ink pt-2">2. How to Request a Refund</h2>
            <p>
              If your selected fare brand supports refunds before departure, you can file a refund request by emailing our operations desk at <a href="mailto:helloworld@booqdat.com" className="text-orangebrand font-black underline">helloworld@booqdat.com</a>. Please include your Booking ID and PNR code.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">3. Unsuccessful Ticketing Failures</h2>
            <p>
              In rare instances, if your payment is accepted but ticketing fails with the carrier (due to price shifts or expiration windows), BOOQDAT USA LLC will immediately initiate a **100% full refund** of all captured funds (including base fare, taxes, and service markup) back to your original payment method.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
