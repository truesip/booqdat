import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const current = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/95 text-ink shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 overflow-hidden rounded-2xl bg-white p-1 shadow-sm ring-1 ring-orange-100">
            <Image src="/booqdat-logo.png" alt="BooqDat logo" width={44} height={44} className="object-contain" />
          </span>
          <span>
            <span className="block text-lg font-black tracking-tight">BooqDat</span>
            <span className="block text-xs font-medium text-ink/50">Travel smarter. Book faster.</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-bold text-ink/65 md:flex">
          <Link href="/flights/search?origin=ATL&destination=LAX&departureDate=2026-07-10&returnDate=2026-07-17&adults=1&tripType=round-trip&cabinClass=economy" className="hover:text-orangebrand">
            Flights
          </Link>
          <Link href="/coming-soon/hotels" className="hover:text-orangebrand">
            Hotels
          </Link>
          <Link href="/coming-soon/cars" className="hover:text-orangebrand">
            Car rentals
          </Link>
          <Link href="/coming-soon/events" className="hover:text-orangebrand">
            Event tickets
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {current ? (
            <LinkButton href="/dashboard" variant="light" className="px-4 py-2">
              Dashboard
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-bold text-ink/70 hover:text-orangebrand sm:block">
                Sign in
              </Link>
              <LinkButton href="/register" variant="primary" className="px-4 py-2">
                Join free
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
