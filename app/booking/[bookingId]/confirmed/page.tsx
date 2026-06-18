import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";
import { getBookingById } from "@/lib/bookings";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Confirmed</p>
          <h1 className="mt-4 text-4xl font-black">Your flight is booked.</h1>
          <p className="mt-4 text-ink/65">Use this airline booking reference to manage your trip with the carrier.</p>
          <div className="mx-auto mt-8 max-w-sm rounded-3xl bg-orangebrand/10 p-6 text-ink">
            <p className="text-sm font-bold text-ink/50">Airline booking reference</p>
            <p className="mt-2 text-4xl font-black tracking-widest">{booking.airlineBookingReference ?? "PENDING"}</p>
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/dashboard/orders" variant="light">
              View orders purchased
            </LinkButton>
            <LinkButton href="/" variant="ghost">
              Back home
            </LinkButton>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
