import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBookingById } from "@/lib/bookings";
import { StatusTracker } from "@/components/flights/status-tracker";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function BookingStatusPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <StatusTracker bookingId={bookingId} initialBooking={booking} />
      </section>
      <SiteFooter />
    </main>
  );
}
