import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";
import { getBookingById } from "@/lib/bookings";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Check, Plane, Calendar, Users, Mail, Phone, Ticket } from "lucide-react";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) notFound();

  const isEvent = booking.vertical === "events";
  const reference = isEvent ? (booking._id?.toString().slice(-8).toUpperCase() ?? "CONFIRMED") : (booking.airlineBookingReference ?? "PENDING");

  return (
    <main className="min-h-screen bg-cloud">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="rounded-[2.5rem] border border-orangebrand/10 bg-white p-8 md:p-12 text-center text-ink shadow-card mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-sm mb-6">
            <Check className="h-10 w-10 stroke-[3px]" />
          </div>
          <span className="inline-flex text-xs font-black uppercase tracking-[0.35em] text-green-600 bg-green-50 px-4 py-1.5 rounded-full border border-green-100">
            Booking Confirmed
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-ink md:text-5xl">
            {isEvent ? "Your tickets are booked!" : "Your flight is booked!"}
          </h1>
          <p className="mt-4 text-base font-semibold text-ink/60 max-w-xl mx-auto">
            {isEvent
              ? `Get ready to discover outside! Your tickets have been issued successfully. A confirmation email has been sent to ${booking.contact.email}.`
              : `Pack your bags! Your flight has been ticketed successfully. A confirmation email has been sent to ${booking.contact.email}.`}
          </p>

          <div className="mx-auto mt-8 max-w-md rounded-[2rem] bg-orangebrand/5 border border-orangebrand/10 p-8 text-ink">
            <p className="text-xs font-black uppercase tracking-widest text-ink/40">
              {isEvent ? "BooqDat Ticket Reference" : "Airline Booking Reference (PNR)"}
            </p>
            <p className="mt-3 text-5xl font-black tracking-widest text-orangebrand">{reference}</p>
            <p className="mt-4 text-xs font-bold text-ink/50 leading-relaxed">
              {isEvent
                ? "Show this confirmation reference or the email ticket at the entrance of the venue."
                : "Use this code to check-in, select seats, or make changes directly on the airline's website or app."}
            </p>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/dashboard/orders" variant="light" className="h-14 px-6 text-sm font-black">
              View Order History
            </LinkButton>
            <LinkButton href="/" variant="ghost" className="h-14 px-6 text-sm font-black">
              Back to Home
            </LinkButton>
          </div>
        </div>

        {/* Vertical Specific Details */}
        {isEvent ? (
          <div className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-card border border-orangebrand/5 mb-8">
            <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6 border-b border-orange-50 pb-4">
              <Ticket className="h-5 w-5 text-orangebrand" />
              Event Information
            </h2>
            <div className="bg-cloud rounded-[2rem] p-6 md:p-8 border border-orange-100 space-y-4">
              <p className="text-2xl font-black text-ink">{booking.eventSnapshot?.eventTitle}</p>
              <div className="grid gap-4 md:grid-cols-2 text-sm font-semibold text-ink/75 pt-2 border-t border-orange-100/50">
                <div>
                  <p className="text-xs font-black text-ink/40 uppercase">Date & Time</p>
                  <p className="mt-1">
                    {booking.eventSnapshot?.eventDate
                      ? new Date(booking.eventSnapshot.eventDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                    {booking.eventSnapshot?.eventTime ? ` at ${booking.eventSnapshot.eventTime}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black text-ink/40 uppercase">Venue Location</p>
                  <p className="mt-1">{booking.eventSnapshot?.venue}, {booking.eventSnapshot?.city}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-card border border-orangebrand/5 mb-8">
            <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6 border-b border-orange-50 pb-4">
              <Plane className="h-5 w-5 text-orangebrand" />
              Flight Itinerary
            </h2>

            <div className="space-y-6">
              {booking.offerSnapshot!.slices.map((slice, sIdx) => (
                <div key={sIdx} className="bg-cloud rounded-[2rem] p-6 md:p-8 border border-orange-100">
                  <div className="flex items-center justify-between border-b border-orange-100/50 pb-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-orangebrand px-3 py-1 text-xs font-black text-white">
                        {sIdx === 0 ? "Outbound" : "Return"}
                      </span>
                      <span className="text-sm font-black text-ink">
                        {slice.segments[0]?.operatingCarrierName ?? booking.offerSnapshot!.ownerName}
                      </span>
                    </div>
                    <span className="text-xs font-black text-ink/50">
                      Duration: {slice.duration ? slice.duration.replace("PT", "").toLowerCase() : "N/A"}
                    </span>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-3xl font-black text-ink">{slice.originCode}</p>
                      <p className="text-sm font-semibold text-ink/50 mt-1">{slice.originName}</p>
                      <p className="text-sm font-black text-orangebrand mt-2">{formatDateTime(slice.departingAt)}</p>
                    </div>

                    <div className="hidden md:flex flex-col items-center flex-1 max-w-[150px] px-4">
                      <span className="text-xs font-black text-ink/40 uppercase tracking-widest">
                        {slice.segments.length > 1 ? `${slice.segments.length - 1} stop` : "non-stop"}
                      </span>
                      <div className="w-full h-0.5 bg-orangebrand/25 relative my-3">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-orangebrand" />
                      </div>
                      <span className="text-xs font-bold text-ink/40">
                        {slice.segments[0]?.flightNumber ? `Flight ${slice.segments[0].flightNumber}` : ""}
                      </span>
                    </div>

                    <div className="md:text-right">
                      <p className="text-3xl font-black text-ink">{slice.destinationCode}</p>
                      <p className="text-sm font-semibold text-ink/50 mt-1">{slice.destinationName}</p>
                      <p className="text-sm font-black text-orangebrand mt-2">{formatDateTime(slice.arrivingAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passenger Information */}
        <div className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-card border border-orangebrand/5 mb-8">
          <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6 border-b border-orange-50 pb-4">
            <Users className="h-5 w-5 text-orangebrand" />
            {isEvent ? "Guest Details" : "Passenger Details"}
          </h2>

          <div className="space-y-4">
            {booking.passengers.map((passenger, pIdx) => (
              <div key={passenger.id ?? pIdx} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-cloud rounded-[1.5rem] border border-orange-50">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orangebrand">
                    {isEvent ? `Guest ${pIdx + 1}` : `Adult ${pIdx + 1}`}
                  </span>
                  <p className="font-black text-ink mt-0.5 text-lg">
                    {passenger.title ? passenger.title.charAt(0).toUpperCase() + passenger.title.slice(1) : ""} {passenger.givenName} {passenger.familyName}
                  </p>
                  <p className="text-sm font-semibold text-ink/50 mt-1 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> Date of Birth: {new Date(passenger.bornOn).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="mt-3 md:mt-0 text-xs font-black text-ink/65 bg-white border border-orange-100/50 px-4 py-2 rounded-xl">
                  Gender: {passenger.gender === "m" ? "Male" : passenger.gender === "f" ? "Female" : "Unspecified"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Contact Details */}
          <div className="rounded-[2.5rem] bg-white p-8 shadow-card border border-orangebrand/5">
            <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6 border-b border-orange-50 pb-4">
              <Mail className="h-5 w-5 text-orangebrand" />
              Contact Info
            </h2>
            <div className="space-y-4 text-sm font-semibold text-ink/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orangebrand/10 text-orangebrand">
                  <Mail className="h-5 w-5" />
                </div>
                <span>{booking.contact.email}</span>
              </div>
              {booking.contact.phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orangebrand/10 text-orangebrand">
                    <Phone className="h-5 w-5" />
                  </div>
                  <span>{booking.contact.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="rounded-[2.5rem] bg-white p-8 shadow-card border border-orangebrand/5">
            <h2 className="text-xl font-black text-ink flex items-center gap-2 mb-6 border-b border-orange-50 pb-4">
              <Ticket className="h-5 w-5 text-orangebrand" />
              Receipt Details
            </h2>
            <div className="space-y-3 text-sm font-semibold border-b border-slate-50 pb-4 mb-4">
              <div className="flex justify-between items-center text-ink/65">
                <span>{isEvent ? "Ticket base fare" : "Flight base fare & taxes"}</span>
                <span>{formatCurrency(booking.amount - booking.serviceFeeAmount, booking.currency)}</span>
              </div>
              <div className="flex justify-between items-center text-ink/65">
                <span>BooqDat service markup</span>
                <span>{formatCurrency(booking.serviceFeeAmount, booking.currency)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-lg font-black text-ink">
              <span>Total paid</span>
              <span className="text-orangebrand">{formatCurrency(booking.amount, booking.currency)}</span>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
