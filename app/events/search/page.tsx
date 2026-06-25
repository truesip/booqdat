import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Field, Input } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";
import { getEvents } from "@/lib/events";
import { asString, formatCurrency } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, DollarSign, ArrowRight } from "lucide-react";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const city = asString(params?.city, "");
  const date = asString(params?.date, "");
  const price = asString(params?.price, "");

  const events = await getEvents({ city, date, maxPrice: price });

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />

      {/* Hero Header */}
      <section className="bg-orangebrand px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-100">Live Experiences</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            Find Your Next Event
          </h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Discover concerts, comedy, nightlife, and community events. Book instant tickets securely on BooqDat.
          </p>

          {/* Search Form */}
          <div className="mt-8 max-w-5xl">
            <form action="/events/search" method="GET" className="grid gap-4 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-orangebrand/15 md:grid-cols-4 items-end">
              <Field label="City">
                <Input
                  name="city"
                  placeholder="e.g. Albuquerque"
                  defaultValue={city}
                  className="text-ink"
                />
              </Field>
              <Field label="Date">
                <Input
                  name="date"
                  type="date"
                  defaultValue={date}
                  className="text-ink"
                />
              </Field>
              <Field label="Max Ticket Price ($)">
                <Input
                  name="price"
                  type="number"
                  placeholder="e.g. 50"
                  defaultValue={price}
                  className="text-ink"
                />
              </Field>
              <Button type="submit" className="h-12 w-full text-sm font-black bg-orangebrand hover:bg-orangeburnt rounded-2xl">
                Search Events
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Events Results Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {events.length === 0 ? (
          <div className="rounded-[2.5rem] border border-orange-100 bg-white p-12 text-center shadow-card">
            <p className="text-lg font-bold text-ink/50">No events found matching your search filters.</p>
            <p className="text-sm text-ink/40 mt-2">Try clearing your filters or exploring another city.</p>
            <div className="mt-6">
              <LinkButton href="/events/search" variant="ghost" className="text-xs">
                Clear Filters
              </LinkButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const eventIdStr = event._id?.toString() ?? "";
              const formattedDate = new Date(event.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <article
                  key={eventIdStr}
                  className="group flex flex-col overflow-hidden rounded-[2.5rem] border border-orangebrand/10 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-glow"
                >
                  {/* Event Image */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    {event.banner ? (
                      <Image
                        src={event.banner}
                        alt={event.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orangebrand font-black">
                        {event.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase text-orangebrand shadow-sm">
                      {event.category || "General"}
                    </span>
                  </div>

                  {/* Event Details */}
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-xl font-black text-ink line-clamp-1 group-hover:text-orangebrand transition">
                      {event.title}
                    </h2>
                    <p className="mt-2 text-sm text-ink/60 line-clamp-2 min-h-[2.5rem]">
                      {event.description}
                    </p>

                    <div className="mt-4 space-y-2.5 text-xs font-semibold text-ink/50 border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-orangebrand" />
                        <span>{formattedDate} {event.time ? `at ${event.time}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-orangebrand" />
                        <span className="line-clamp-1">{event.venue}, {event.city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 shrink-0 text-orangebrand" />
                        <span>GA: {formatCurrency(event.gaPrice || 0, "USD")} {event.vipPrice ? `· VIP: ${formatCurrency(event.vipPrice || 0, "USD")}` : ""}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-2 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-ink/30">Tickets From</span>
                        <span className="text-xl font-black text-orangebrand">{formatCurrency(event.gaPrice || 0, "USD")}</span>
                      </div>
                      <Link
                        href={`/events/booking?eventId=${eventIdStr}`}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white hover:bg-orangebrand transition"
                      >
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
