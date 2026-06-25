import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionClaims } from "@/lib/auth";
import { createBooking } from "@/lib/bookings";
import { calculateFlightPrice, calculateEventPrice } from "@/lib/pricing";
import { getEventById } from "@/lib/events";
import type { NormalizedFlightOffer } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const vertical = body?.vertical || "flights";

  const claims = await getSessionClaims();

  if (vertical === "events") {
    const eventId = body?.eventId as string | undefined;
    const ticketType = body?.ticketType as "ga" | "vip" | undefined;
    const quantity = Number(body?.quantity || 1);

    if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    if (ticketType !== "ga" && ticketType !== "vip") {
      return NextResponse.json({ error: "Invalid or missing ticketType" }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const ticketPrice = (ticketType === "vip" ? (event.vipPrice || event.gaPrice) : event.gaPrice) || 0;
    const price = calculateEventPrice(ticketPrice, quantity);

    const bookingId = await createBooking({
      userId: claims?.sub ? new ObjectId(claims.sub) : undefined,
      guestEmail: claims?.email,
      status: "draft",
      paymentStatus: "created",
      vertical: "events",
      offerId: eventId,
      amount: price.finalAmount,
      currency: price.currency,
      serviceFeeAmount: price.serviceFeeAmount,
      eventSnapshot: {
        eventId,
        eventTitle: event.title,
        eventDate: event.date.toISOString(),
        eventTime: event.time || "",
        city: event.city || "",
        venue: event.venue || "",
        ticketType,
        ticketPrice,
        quantity
      },
      passengers: [],
      contact: {
        email: claims?.email ?? "pending@booqdat.local"
      }
    });

    return NextResponse.json({ bookingId });
  } else {
    const offer = body?.offer as NormalizedFlightOffer | undefined;
    if (!offer?.id) return NextResponse.json({ error: "Missing offer" }, { status: 400 });

    const price = calculateFlightPrice(offer);
    const bookingId = await createBooking({
      userId: claims?.sub ? new ObjectId(claims.sub) : undefined,
      guestEmail: claims?.email,
      status: "draft",
      paymentStatus: "created",
      vertical: "flights",
      offerId: offer.id,
      amount: price.finalAmount,
      currency: price.currency,
      serviceFeeAmount: price.serviceFeeAmount,
      offerSnapshot: offer,
      passengers: [],
      contact: {
        email: claims?.email ?? "pending@booqdat.local"
      }
    });

    return NextResponse.json({ bookingId });
  }
}
