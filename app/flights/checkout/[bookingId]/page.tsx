import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/flights/checkout-form";
import { SelectedFlightsTimeline } from "@/components/flights/selected-flights-timeline";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBookingById } from "@/lib/bookings";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function FlightCheckoutPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

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
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Dynamic Breadcrumbs Nav */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
          <span className="hover:text-orangebrand transition cursor-pointer">Orders</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer">New order</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer">Select flights</span>
          <span>&rsaquo;</span>
          <span className="text-ink/65 font-black">Checkout</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Left Column: Duffel Selected Flights Detailed Timeline */}
          <div className="h-fit rounded-[2.5rem] border border-orangebrand/10 bg-white p-8 shadow-card">
            <SelectedFlightsTimeline
              offer={booking.offerSnapshot}
              tripType={booking.offerSnapshot.slices.length > 1 ? "round-trip" : "one-way"}
            />
          </div>

          {/* Right Column: Checkout Form & Interactive Extras/Metadata/Payments */}
          <div className="space-y-6">
            <CheckoutForm bookingId={bookingId} booking={safeBooking} />
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
