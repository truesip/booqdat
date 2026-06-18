import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/flights/checkout-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBookingById } from "@/lib/bookings";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function FlightCheckoutPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  const firstSlice = booking.offerSnapshot.slices[0];
  const safeBooking = JSON.parse(
    JSON.stringify({
      ...booking,
      _id: undefined,
      userId: undefined,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString()
    })
  );

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.75fr] lg:px-8">
        <CheckoutForm bookingId={bookingId} booking={safeBooking} />
        <aside className="h-fit rounded-[2rem] border border-orangebrand/10 bg-white p-6 text-ink shadow-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-orangebrand">Trip summary</p>
          <h1 className="mt-3 text-3xl font-black">
            {firstSlice?.originCode} → {firstSlice?.destinationCode}
          </h1>
          <p className="mt-2 text-ink/65">{booking.offerSnapshot.ownerName}</p>
          <div className="mt-6 grid gap-4 text-sm">
            {booking.offerSnapshot.slices.map((slice, index) => (
              <div key={`${slice.originCode}-${slice.destinationCode}-${index}`} className="rounded-2xl bg-orangebrand/10 p-4">
                <p className="font-bold">
                  {slice.originCode} to {slice.destinationCode}
                </p>
                <p className="mt-1 text-ink/65">{formatDateTime(slice.departingAt)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-orangebrand/10 bg-cloud p-5 text-ink">
            <div className="flex justify-between text-sm">
              <span>Flight offer</span>
              <span>{formatCurrency(booking.offerSnapshot.totalAmount, booking.currency)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span>BooqDat service fee</span>
              <span>{formatCurrency(booking.serviceFeeAmount, booking.currency)}</span>
            </div>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-black">
              <span>Total</span>
              <span>{formatCurrency(booking.amount, booking.currency)}</span>
            </div>
          </div>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
