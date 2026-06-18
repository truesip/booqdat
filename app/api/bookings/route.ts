import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionClaims } from "@/lib/auth";
import { createBooking } from "@/lib/bookings";
import { calculateFlightPrice } from "@/lib/pricing";
import type { NormalizedFlightOffer } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const offer = body?.offer as NormalizedFlightOffer | undefined;
  if (!offer?.id) return NextResponse.json({ error: "Missing offer" }, { status: 400 });

  const claims = await getSessionClaims();
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
