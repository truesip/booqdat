import Image from "next/image";
import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-hero-radial px-4 py-12">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-card">
        <Link href="/" className="mx-auto mb-6 flex w-fit flex-col items-center gap-2 text-center">
          <span className="relative flex h-16 w-16 overflow-hidden rounded-3xl bg-white p-2 shadow-card ring-1 ring-slate-100">
            <Image src="/booqdat-logo.png" alt="BooqDat logo" width={64} height={64} className="object-contain" />
          </span>
          <span className="text-xl font-black">BooqDat</span>
        </Link>
        <h1 className="text-center text-3xl font-black">{title}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-ink/60">{subtitle}</p>
        <div className="mt-7">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-ink/60">{footer}</div> : null}
      </div>
    </main>
  );
}
