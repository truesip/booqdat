import { NextResponse } from "next/server";
import { getBookingById, updateBookingStatus } from "@/lib/bookings";
import { createDuffelOrder } from "@/lib/duffel";
import { collections, getDb } from "@/lib/mongodb";
import { verifyWhopWebhook } from "@/lib/whop";

export async function POST(request: Request) {
  const bodyText = await request.text();
  if (!verifyWhopWebhook(bodyText, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(bodyText);
  const eventId = event.id ?? event.message_id ?? `${event.type}-${Date.now()}`;
  const db = await getDb();
  const existing = await db.collection(collections.webhookEvents).findOne({ eventId });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  await db.collection(collections.webhookEvents).insertOne({
    eventId,
    type: event.type,
    payload: event,
    createdAt: new Date()
  });

  const bookingId = event.data?.metadata?.bookingId ?? event.data?.metadata?.booking_id;
  if (!bookingId) return NextResponse.json({ ok: true, ignored: true });

  if (event.type === "payment.failed") {
    await updateBookingStatus(bookingId, {
      status: "payment_failed",
      paymentStatus: "failed",
      whopPaymentId: event.data?.id,
      failureReason: event.data?.failure_message ?? "Whop payment failed"
    });
    return NextResponse.json({ ok: true });
  }

  if (event.type === "payment.succeeded") {
    const booking = await getBookingById(bookingId);
    if (!booking) return NextResponse.json({ ok: true, ignored: true });

    await updateBookingStatus(bookingId, {
      status: "ticketing_in_progress",
      paymentStatus: "succeeded",
      whopPaymentId: event.data?.id
    });

    try {
      if (!booking.passengers.length) throw new Error("Passenger details missing for ticketing");
      if (booking.vertical === "events") {
        await updateBookingStatus(bookingId, {
          status: "confirmed",
          paymentStatus: "succeeded"
        });
      } else {
        const order = await createDuffelOrder({ offer: booking.offerSnapshot!, passengers: booking.passengers });
        await updateBookingStatus(bookingId, {
          status: "confirmed",
          paymentStatus: "succeeded",
          duffelOrderId: order.id,
          airlineBookingReference: order.bookingReference
        });
      }
    } catch (error) {
      await updateBookingStatus(bookingId, {
        status: "requires_manual_review",
        failureReason: error instanceof Error ? error.message : "Ticketing failed after payment"
      });
    }
  }

  return NextResponse.json({ ok: true });
}
