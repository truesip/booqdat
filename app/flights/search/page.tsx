import { OfferCard } from "@/components/flights/offer-card";
import { HeroBookingWidget } from "@/components/hero-booking-widget";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { searchFlightOffers } from "@/lib/duffel";
import { asString } from "@/lib/utils";
import { flightSearchSchema } from "@/lib/validators";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FlightSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = flightSearchSchema.safeParse({
    tripType: asString(params?.tripType, "round-trip"),
    origin: asString(params?.origin, "ATL"),
    destination: asString(params?.destination, "LAX"),
    departureDate: asString(params?.departureDate, new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10)),
    returnDate: asString(params?.returnDate, new Date(Date.now() + 86400000 * 21).toISOString().slice(0, 10)),
    adults: asString(params?.adults, "1"),
    cabinClass: asString(params?.cabinClass, "economy")
  });

  const search = parsed.success ? parsed.data : flightSearchSchema.parse({
    tripType: "round-trip",
    origin: "ATL",
    destination: "LAX",
    departureDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
    returnDate: new Date(Date.now() + 86400000 * 21).toISOString().slice(0, 10),
    adults: 1,
    cabinClass: "economy"
  });

  const { offers, offerRequestId } = await searchFlightOffers(search);

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="bg-orangebrand px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-100">Flight search</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            {search.origin} to {search.destination}
          </h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Compare available fares, carrier details, pricing, and expiration windows before checkout.
          </p>
          <div className="mt-8 max-w-5xl">
            <HeroBookingWidget />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-ink/50">Search reference</p>
            <p className="font-mono text-sm text-ink/65">{offerRequestId}</p>
          </div>
          <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-orangeburnt shadow-sm">
            {offers.length} offers found
          </p>
        </div>
        <div className="grid gap-5">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
