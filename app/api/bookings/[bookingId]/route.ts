import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionClaims } from "@/lib/auth";
import { getBookingById } from "@/lib/bookings";
import { collections, getDb } from "@/lib/mongodb";
import type { BookingDocument } from "@/lib/types";
import { createBookingSchema } from "@/lib/validators";

type RouteProps = {
  params: Promise<{ bookingId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { bookingId } = await params;
  const booking = await getBookingById(bookingId);
  if (!booking?._id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const claims = await getSessionClaims();
  if (booking.userId && booking.userId.toString() !== claims?.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.pick({ passengers: true, contact: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });

  const db = await getDb();
  await db.collection<BookingDocument>(collections.bookings).updateOne(
    { _id: new ObjectId(bookingId) },
    {
      $set: {
        passengers: parsed.data.passengers,
        contact: parsed.data.contact,
        guestEmail: parsed.data.contact.email,
        updatedAt: new Date()
      }
    }
  );

  return NextResponse.json({ ok: true });
}
