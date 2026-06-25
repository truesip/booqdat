import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getEventById } from "@/lib/events";
import { BookingSelectionForm } from "@/components/events/booking-selection-form";
import { asString } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventBookingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const eventId = asString(params?.eventId, "");
  if (!eventId) notFound();

  const event = await getEventById(eventId);
  if (!event) notFound();

  const safeEvent = JSON.parse(
    JSON.stringify({
      ...event,
      _id: event._id?.toString(),
      promoterId: event.promoterId.toString(),
      date: event.date.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    })
  );

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-black text-ink/35 select-none uppercase tracking-widest">
          <span className="hover:text-orangebrand transition cursor-pointer">Events</span>
          <span>&rsaquo;</span>
          <span className="hover:text-orangebrand transition cursor-pointer">Search</span>
          <span>&rsaquo;</span>
          <span className="text-ink/65 font-black">Select Tickets</span>
        </nav>

        <div className="rounded-[2.5rem] border border-orangebrand/10 bg-white p-8 shadow-card">
          <BookingSelectionForm event={safeEvent} />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
