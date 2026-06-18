import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-orange-100 bg-white text-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <p className="text-2xl font-black">BooqDat</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink/60">
            BOOQDAT USA LLC is building a premium booking engine for flights today, with hotels, cars, and event tickets coming soon.
          </p>
          <p className="mt-4 text-sm text-ink/50">1209 Mountain Road Pl NE Ste R, Albuquerque, NM 87110</p>
          <a href="mailto:helloworld@booqdat.com" className="mt-2 block text-sm font-semibold text-orangebrand">
            helloworld@booqdat.com
          </a>
        </div>
        <div>
          <p className="font-bold">Travel</p>
          <div className="mt-4 grid gap-2 text-sm text-ink/60">
            <Link href="/flights/search">Flights</Link>
            <Link href="/coming-soon/hotels">Hotels coming soon</Link>
            <Link href="/coming-soon/cars">Car rentals coming soon</Link>
            <Link href="/coming-soon/events">Event tickets coming soon</Link>
          </div>
        </div>
        <div>
          <p className="font-bold">Account</p>
          <div className="mt-4 grid gap-2 text-sm text-ink/60">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/orders">Orders purchased</Link>
            <Link href="/dashboard/payment-methods">Payment methods</Link>
            <Link href="/dashboard/security">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
