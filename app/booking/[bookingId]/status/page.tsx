import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBookingById, updateBookingStatus } from "@/lib/bookings";
import { createDuffelOrder } from "@/lib/duffel";
import { formatCurrency } from "@/lib/utils";

type PageProps = {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingStatusPage({ params, searchParams }: PageProps) {
  const { bookingId } = await params;
  const query = await searchParams;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  if (query?.mockPayment === "1" && booking.status !== "confirmed") {
    let confirmed = false;
    try {
      await updateBookingStatus(bookingId, { status: "ticketing_in_progress", paymentStatus: "succeeded", whopPaymentId: `pay_mock_${bookingId}` });
      const order = await createDuffelOrder({ offer: booking.offerSnapshot, passengers: booking.passengers });
      await updateBookingStatus(bookingId, {
        status: "confirmed",
        paymentStatus: "succeeded",
        duffelOrderId: order.id,
        airlineBookingReference: order.bookingReference
      });
      confirmed = true;
    } catch (error) {
      await updateBookingStatus(bookingId, {
        status: "requires_manual_review",
        failureReason: error instanceof Error ? error.message : "Ticketing failed after payment"
      });
    }
    if (confirmed) redirect(`/booking/${bookingId}/confirmed`);
  }

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
