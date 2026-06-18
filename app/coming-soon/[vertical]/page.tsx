import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const content = {
  hotels: {
    title: "Hotels are coming to BooqDat.",
    body: "Premium stays, business-ready rooms, and curated escapes will join the booking engine soon."
  },
  cars: {
    title: "Car rentals are coming to BooqDat.",
    body: "Airport pickups, luxury rentals, and road-trip inventory will be added after flights are live."
  },
  events: {
    title: "Event tickets are coming to BooqDat.",
    body: "Concerts, sports, nightlife, and destination experiences will become part of the trip flow."
  }
} as const;

type PageProps = {
  params: Promise<{ vertical: keyof typeof content }>;
};

export default async function ComingSoonPage({ params }: PageProps) {
  const { vertical } = await params;
  const page = content[vertical];
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="px-4 py-20 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Coming soon</p>
          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">{page.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-ink/65">{page.body}</p>
          <form action="/api/waitlist" method="post" className="mx-auto mt-8 flex max-w-xl flex-col gap-3 rounded-[2rem] bg-white p-3 shadow-card ring-1 ring-orangebrand/15 sm:flex-row">
            <input type="hidden" name="vertical" value={vertical} />
            <Input name="email" type="email" placeholder="you@example.com" required />
            <Button type="submit">Join waitlist</Button>
          </form>
          <div className="mt-5">
            <LinkButton href="/flights/search" variant="ghost">
              Book flights now
            </LinkButton>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
