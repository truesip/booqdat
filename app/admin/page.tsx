import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { listOperationalBookings } from "@/lib/bookings";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function AdminPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/admin");
  if (current.user.role !== "admin") redirect("/dashboard");

  const bookings = await listOperationalBookings([
    "requires_manual_review",
    "ticketing_failed",
    "ticketing_in_progress",
    "payment_succeeded"
  ]);

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Operations</p>
          <h1 className="mt-3 text-4xl font-black">Paid-but-not-ticketed review queue</h1>
          <p className="mt-3 max-w-2xl text-ink/65">
            Monitor payments that need ticketing follow-up, retries, refunds, or customer re-quotes.
          </p>
        </div>
        <div className="mt-8 grid gap-4">
          {bookings.length ? bookings.map((booking) => (
            <Link
              key={booking._id?.toString()}
              href={`/dashboard/orders/${booking._id?.toString()}`}
              className="rounded-[2rem] bg-white p-6 shadow-card transition hover:-translate-y-1"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xl font-black">
                    {booking.offerSnapshot.slices[0]?.originCode} → {booking.offerSnapshot.slices[0]?.destinationCode}
                  </p>
                  <p className="mt-1 text-sm text-ink/55">
                    Updated {formatDateTime(booking.updatedAt)} · {booking.contact.email}
                  </p>
                  {booking.failureReason ? <p className="mt-2 text-sm font-semibold text-coral">{booking.failureReason}</p> : null}
                </div>
                <div className="text-left md:text-right">
                  <p className="font-black">{formatCurrency(booking.amount, booking.currency)}</p>
                  <p className="mt-1 text-sm font-bold text-orangeburnt">{booking.status.replaceAll("_", " ")}</p>
                </div>
              </div>
            </Link>
          )) : (
            <div className="rounded-[2rem] bg-white p-8 text-center shadow-card">
              <p className="text-2xl font-black">No operational exceptions.</p>
              <p className="mt-2 text-sm text-ink/60">Paid-but-not-ticketed bookings will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
