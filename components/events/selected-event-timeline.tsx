import type { EventTicketSnapshot } from "@/lib/types";
import { Users } from "lucide-react";

export function SelectedEventTimeline({ event }: { event: EventTicketSnapshot }) {
  const formattedDate = new Date(event.eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 text-ink">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-orangebrand">Selected Experience</p>
        <h2 className="mt-2 text-2xl font-black">{event.eventTitle}</h2>
      </div>

      <div className="relative border-l-2 border-dashed border-orangebrand/20 pl-6 ml-1 space-y-6">
        {/* Date node */}
        <div className="relative">
          <span className="absolute -left-8 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-orangebrand">
            <span className="h-1.5 w-1.5 rounded-full bg-orangebrand" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ink/40">Date & Time</p>
            <p className="mt-1 text-sm font-bold text-ink">{formattedDate}</p>
            {event.eventTime && (
              <p className="mt-0.5 text-xs text-ink/65">Starts at {event.eventTime}</p>
            )}
          </div>
        </div>

        {/* Location node */}
        <div className="relative">
          <span className="absolute -left-8 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-orangebrand">
            <span className="h-1.5 w-1.5 rounded-full bg-orangebrand" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ink/40">Venue Location</p>
            <p className="mt-1 text-sm font-bold text-ink">{event.venue}</p>
            <p className="mt-0.5 text-xs text-ink/65">{event.city}</p>
          </div>
        </div>

        {/* Ticket Type & Quantity node */}
        <div className="relative">
          <span className="absolute -left-8 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-orangebrand">
            <span className="h-1.5 w-1.5 rounded-full bg-orangebrand" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ink/40">Ticket Details</p>
            <p className="mt-1 text-sm font-bold text-ink uppercase">
              {event.ticketType === "vip" ? "VIP Pass" : "General Admission"}
            </p>
            <p className="mt-0.5 text-xs text-ink/65">
              Quantity: {event.quantity} ticket{event.quantity > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-orange-50/50 border border-orange-100/50 p-4 flex gap-3 text-xs font-semibold text-ink/65">
        <Users className="h-4.5 w-4.5 text-orangebrand shrink-0" />
        <p>
          Please make sure name(s) and email(s) on the next step match your official identity documents.
        </p>
      </div>
    </div>
  );
}
