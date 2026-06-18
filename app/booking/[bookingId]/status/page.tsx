import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBookingById } from "@/lib/bookings";
import { formatCurrency } from "@/lib/utils";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function BookingStatusPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  const refreshed = await getBookingById(bookingId);
  if (!refreshed) notFound();

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-ocean">Booking status</p>
          <h1 className="mt-4 text-4xl font-black">{refreshed.status.replaceAll("_", " ")}</h1>
          <p className="mt-4 text-ink/60">
            Payment status: <span className="font-bold text-ink">{refreshed.paymentStatus}</span>
          </p>
          <p className="mt-2 text-ink/60">
            Total: <span className="font-bold text-ink">{formatCurrency(refreshed.amount, refreshed.currency)}</span>
          </p>
          {refreshed.failureReason ? (
            <p className="mt-5 rounded-2xl bg-coral/10 p-4 text-sm font-semibold text-coral">{refreshed.failureReason}</p>
          ) : (
            <p className="mt-5 rounded-2xl bg-aqua/10 p-4 text-sm font-semibold text-ocean">
              Your booking is being monitored. Confirmed orders will show the airline booking reference here and in your dashboard.
            </p>
          )}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
