import { NextResponse } from "next/server";
import { collections, getDb } from "@/lib/mongodb";
import { getBookingById } from "@/lib/bookings";
import { createWhopCheckoutConfiguration } from "@/lib/whop";
import type { BookingDocument } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const bookingId = body?.bookingId;
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const booking = await getBookingById(bookingId);
  if (!booking?._id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!booking.passengers.length || !booking.contact.email || booking.contact.email === "pending@booqdat.local") {
    return NextResponse.json({ error: "Passenger and contact details required" }, { status: 400 });
  }

  const checkout = await createWhopCheckoutConfiguration({
    bookingId,
    amount: booking.amount,
    currency: booking.currency,
    customerEmail: booking.contact.email,
    metadata: {
      duffelOfferId: booking.offerId,
      customerId: booking.userId?.toString() ?? "guest",
      environment: process.env.NODE_ENV ?? "development"
    }
  });

  const db = await getDb();
  await db.collection<BookingDocument>(collections.bookings).updateOne(
    { _id: booking._id },
    {
      $set: {
        status: "pending_payment",
        paymentStatus: "pending",
        whopCheckoutConfigId: checkout.id,
        updatedAt: new Date()
      }
    }
  );

  return NextResponse.json({
    sessionId: checkout.id,
    planId: checkout.planId,
    purchaseUrl: checkout.purchaseUrl,
    environment: checkout.purchaseUrl?.includes("sandbox.whop.com") ? "sandbox" : "production"
  });
}
