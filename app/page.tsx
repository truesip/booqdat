import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeroBookingWidget } from "@/components/hero-booking-widget";
import { MarketingSections } from "@/components/marketing-sections";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <section className="relative overflow-hidden bg-hero-radial text-ink">
        <div className="absolute right-[-10rem] top-[-10rem] h-96 w-96 rounded-full bg-orange-200/50 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-8rem] h-80 w-80 rounded-full bg-orange-100 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-black text-orangeburnt ring-1 ring-orange-200">
              Flights available now · Hotels, cars, and events coming soon
            </p>
            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-[4.2rem] lg:leading-[0.96]">
              Discover OutSide
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/65">
              BooqDat is a modern travel booking experience for customers who want fast flight search, clear pricing, and secure checkout.
            </p>
          </div>
          <div className="lg:pt-8">
            <HeroBookingWidget />
          </div>
        </div>
      </section>
      <MarketingSections />
      <SiteFooter />
    </main>
  );
}
