import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-orange-100 bg-white text-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <p className="text-2xl font-black">BooqDat</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink/60">
            BOOQDAT USA LLC is a premium booking engine for flights, providing fast, clear pricing, and secure checkout.
          </p>
          <p className="mt-4 text-sm text-ink/50">1209 Mountain Road Pl NE Ste R, Albuquerque, NM 87110</p>
          <a href="mailto:helloworld@booqdat.com" className="mt-2 block text-sm font-semibold text-orangebrand">
            helloworld@booqdat.com
          </a>
        </div>
        <div>
          <p className="font-bold">Policies</p>
          <div className="mt-4 grid gap-2 text-sm text-ink/60">
            <Link href="/terms" className="hover:text-orangebrand">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-orangebrand">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-orangebrand">Refund Policy</Link>
            <Link href="/changes" className="hover:text-orangebrand">Flight Changes</Link>
          </div>
        </div>
        <div>
          <p className="font-bold">Partners Access</p>
          <div className="mt-4 grid gap-2 text-sm text-ink/60">
            <Link href="/login?role=promoter" className="hover:text-orangebrand">Promoter Login</Link>
            <Link href="/register/promoter" className="hover:text-orangebrand">Become a Promoter</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
