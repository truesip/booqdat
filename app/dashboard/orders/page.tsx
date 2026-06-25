import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listUserBookings } from "@/lib/bookings";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function OrdersPage() {
  const current = await getCurrentUser();
  const bookings = current?.user._id ? await listUserBookings(current.user._id.toString()) : [];

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-card">
      <h1 className="text-3xl font-black">Orders purchased</h1>
      <p className="mt-2 text-sm text-ink/60">Track flight purchases, payment status, ticketing status, and airline references.</p>
      <div className="mt-6 grid gap-4">
        {bookings.length ? bookings.map((booking) => {
          const isEvent = booking.vertical === "events";
          const title = isEvent
            ? booking.eventSnapshot?.eventTitle
            : `${booking.offerSnapshot?.slices[0]?.originCode} → ${booking.offerSnapshot?.slices[0]?.destinationCode}`;
          const subtitle = isEvent
            ? formatDateTime(booking.eventSnapshot?.eventDate)
            : formatDateTime(booking.offerSnapshot?.slices[0]?.departingAt);
          return (
            <Link key={booking._id?.toString()} href={`/dashboard/orders/${booking._id?.toString()}`} className="rounded-3xl border border-slate-100 bg-cloud p-5 transition hover:border-aqua">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-lg font-black">{title}</p>
                  <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-black">{formatCurrency(booking.amount, booking.currency)}</p>
                  <p className="mt-1 text-sm font-semibold text-ocean">{booking.status.replaceAll("_", " ")}</p>
                </div>
              </div>
            </Link>
          );
        }) : (
          <div className="rounded-3xl bg-cloud p-8 text-center">
            <p className="text-xl font-black">No orders yet.</p>
            <p className="mt-2 text-sm text-ink/60">Book a flight to see your purchases here.</p>
            <Link href="/flights/search" className="mt-5 inline-flex rounded-full bg-orangebrand px-5 py-3 text-sm font-bold text-white transition hover:bg-orangeburnt">Search flights</Link>
          </div>
        )}
      </div>
    </div>
  );
}
