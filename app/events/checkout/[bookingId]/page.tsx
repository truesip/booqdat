import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getBookingById } from "@/lib/bookings";
import { CheckoutForm } from "@/components/events/checkout-form";
import { SelectedEventTimeline } from "@/components/events/selected-event-timeline";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function EventCheckoutPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking || booking.vertical !== "events" || !booking.eventSnapshot) {
    notFound();
  }

  const safeBooking = JSON.parse(
    JSON.stringify({
      ...booking,
      _id: undefined,
      userId: undefined,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    })
  );

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
          <span className="hover:text-orangebrand transition cursor-pointer">Orders</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer">New order</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer">Select Tickets</span>
          <span>&rsaquo;</span>
          <span className="text-ink/65 font-black">Checkout</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Left Column: Event details timeline */}
          <div className="h-fit rounded-[2.5rem] border border-orangebrand/10 bg-white p-8 shadow-card">
            <SelectedEventTimeline event={booking.eventSnapshot} />
          </div>

          {/* Right Column: Checkout form & Interactive elements */}
          <div className="space-y-6">
            <CheckoutForm bookingId={bookingId} booking={safeBooking} />
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
