import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-white p-8 md:p-12 text-ink shadow-card border border-orangebrand/5">
          <p className="text-xs font-black uppercase tracking-widest text-orangebrand">Policies</p>
          <h1 className="mt-3 text-4xl font-black text-ink">Privacy Policy</h1>
          <p className="mt-2 text-xs font-bold text-ink/40 uppercase">Effective Date: June 25, 2026</p>
          
          <div className="mt-8 space-y-6 text-sm leading-6 text-ink/70 font-semibold">
            <p>
              At BOOQDAT USA LLC, we value your trust and are committed to protecting your personal data. This Privacy Policy describes how we collect, use, and share your personal information when you use our services.
            </p>
            
            <h2 className="text-lg font-black text-ink pt-2">1. Personal Information We Collect</h2>
            <p>
              When you purchase a flight offer through BooqDat, we collect certain personal information necessary to process your reservation, including:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contact details (email address and phone number).</li>
              <li>Passenger personal details (given names, family names, titles, date of birth, and genders).</li>
              <li>Passenger passport details (passport number, country of issue, and expiry date).</li>
            </ul>

            <h2 className="text-lg font-black text-ink pt-2">2. How We Use Your Information</h2>
            <p>
              We use your information solely to process flight bookings with airline carriers, verify identity securely via Whop, calculate accurate fees, send transactional status receipts, and handle operational support requests.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">3. Sharing with Third Parties</h2>
            <p>
              To complete your bookings and transactions, we securely transfer passenger personal/passport details to our live flight carrier partners (facilitated by Duffel.com) and payment processing partners (Whop.com). We never sell or license your personal information to third parties.
            </p>

            <h2 className="text-lg font-black text-ink pt-2">4. Your Rights</h2>
            <p>
              You have the right to request access to, correction of, or deletion of your personal data stored on our servers. To do so, please contact our privacy desk at <a href="mailto:helloworld@booqdat.com" className="text-orangebrand font-black underline">helloworld@booqdat.com</a>.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
