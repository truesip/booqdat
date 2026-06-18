import { ArrowRight, BadgeCheck, Bell, Globe2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

const destinations = [
  ["Tulum", "Beach escapes with hotel drops coming soon"],
  ["Dubai", "Premium long-haul flight inspiration"],
  ["Paris", "Romantic city breaks and events"],
  ["Tokyo", "Future multi-city adventures"]
];

const comingSoon = [
  ["Hotels", "Curated stays, boutique escapes, and business-ready rooms.", "/coming-soon/hotels"],
  ["Car rentals", "Airport pickup, luxury rentals, and road-trip inventory.", "/coming-soon/cars"],
  ["Event tickets", "Concerts, sports, nightlife, and destination experiences.", "/coming-soon/events"]
];

const valueCards: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Fast flight booking",
    body: "Search flights, compare fares, and move from offer to checkout in minutes.",
    icon: Sparkles
  },
  {
    title: "Payment confidence",
    body: "A secure checkout flow and order tracking system keep purchases easy to follow.",
    icon: ShieldCheck
  },
  {
    title: "Account control",
    body: "Track orders, profile details, and saved payment previews from your dashboard.",
    icon: BadgeCheck
  }
];

export function MarketingSections() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {valueCards.map(({ title, body, icon: Icon }) => (
            <div key={title} className="rounded-[2rem] bg-white p-7 shadow-card">
              <Icon className="h-9 w-9 text-orangebrand" />
              <h3 className="mt-5 text-xl font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Travel ideas</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Destinations that keep users exploring.</h2>
            </div>
            <LinkButton href="/flights/search" variant="primary">
              Explore flights <ArrowRight className="ml-2 h-4 w-4" />
            </LinkButton>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {destinations.map(([name, body], index) => (
              <div key={name} className="group overflow-hidden rounded-[2rem] bg-white p-1 shadow-card ring-1 ring-orange-100">
                <div className="flex min-h-64 flex-col justify-end rounded-[1.7rem] bg-gradient-to-br from-orange-50 via-white to-orange-100 p-6 text-ink transition group-hover:from-orange-100">
                  <Globe2 className="mb-auto h-8 w-8 text-orangebrand" />
                  <p className="text-3xl font-black">{name}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{body}</p>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-orangeburnt">Drop {index + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-orangebrand p-8 text-white shadow-card md:p-12">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Bell className="h-10 w-10 text-sun" />
              <h2 className="mt-5 text-4xl font-black tracking-tight">More than flights is coming.</h2>
              <p className="mt-4 text-white/85">
                Hotels, car rentals, and event tickets are designed as premium verticals, but they stay clearly marked Coming Soon until inventory is ready.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {comingSoon.map(([title, body, href]) => (
                <a key={title} href={href} className="rounded-[2rem] bg-white p-5 text-ink ring-1 ring-white/30 transition hover:-translate-y-1 hover:bg-orange-50">
                  <p className="text-xl font-black">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{body}</p>
                  <span className="mt-5 inline-flex text-sm font-bold text-orangeburnt">Join waitlist</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
