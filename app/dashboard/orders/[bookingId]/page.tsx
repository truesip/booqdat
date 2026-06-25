import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBookingById } from "@/lib/bookings";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  const current = await getCurrentUser();
  const booking = await getBookingById(bookingId);

  if (!booking || !current?.user._id || booking.userId?.toString() !== current.user._id.toString()) {
    notFound();
  }

  const isEvent = booking.vertical === "events";
  const title = isEvent ? booking.eventSnapshot?.eventTitle : `${booking.offerSnapshot?.slices[0]?.originCode} → ${booking.offerSnapshot?.slices[0]?.destinationCode}`;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] bg-white p-6 shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-orangebrand">Order detail</p>
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Booking status" value={booking.status.replaceAll("_", " ")} />
          <Stat label="Payment status" value={booking.paymentStatus} />
          <Stat label="Total" value={formatCurrency(booking.amount, booking.currency)} />
          <Stat label="Payment reference" value={booking.whopPaymentId ?? "Pending"} />
          {!isEvent && <Stat label="Ticketing reference" value={booking.duffelOrderId ?? "Pending"} />}
          {!isEvent && <Stat label="Airline reference" value={booking.airlineBookingReference ?? "Pending"} />}
        </div>
      </section>
      <section className="rounded-[2rem] bg-white p-6 shadow-card">
        <h2 className="text-2xl font-black">{isEvent ? "Event Details" : "Itinerary"}</h2>
        <div className="mt-5 grid gap-4">
          {isEvent ? (
            <div className="rounded-3xl bg-cloud p-5">
              <p className="font-black">{booking.eventSnapshot?.eventTitle}</p>
              <p className="mt-1 text-sm text-ink/60">
                Date: {booking.eventSnapshot?.eventDate ? new Date(booking.eventSnapshot.eventDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
                {booking.eventSnapshot?.eventTime ? ` at ${booking.eventSnapshot.eventTime}` : ""}
              </p>
              <p className="mt-1 text-sm text-ink/60">Venue: {booking.eventSnapshot?.venue}, {booking.eventSnapshot?.city}</p>
              <p className="mt-3 text-sm font-semibold text-orangeburnt">Ticket type: {booking.eventSnapshot?.ticketType === "vip" ? "VIP Pass" : "General Admission"}</p>
              <p className="mt-1 text-sm font-semibold text-orangeburnt">Quantity: {booking.eventSnapshot?.quantity}</p>
            </div>
          ) : (
            booking.offerSnapshot!.slices.map((slice, index) => (
              <div key={`${slice.originCode}-${index}`} className="rounded-3xl bg-cloud p-5">
                <p className="font-black">{slice.originCode} to {slice.destinationCode}</p>
                <p className="mt-1 text-sm text-ink/60">{formatDateTime(slice.departingAt)} → {formatDateTime(slice.arrivingAt)}</p>
                <p className="mt-3 text-sm font-semibold text-orangeburnt">Carrier: {slice.segments[0]?.operatingCarrierName}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-cloud p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/45">{label}</p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  );
}
