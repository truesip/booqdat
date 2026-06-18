import { ObjectId } from "mongodb";
import { collections, getDb } from "@/lib/mongodb";
import type { BookingDocument, BookingStatus, PaymentMethodDocument } from "@/lib/types";

export async function createBooking(booking: Omit<BookingDocument, "_id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<BookingDocument>(collections.bookings).insertOne({
    ...booking,
    createdAt: now,
    updatedAt: now
  });

  return result.insertedId.toString();
}

export async function getBookingById(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection<BookingDocument>(collections.bookings).findOne({ _id: new ObjectId(id) });
}

export async function getBookingByDuffelOrderId(duffelOrderId: string) {
  const db = await getDb();
  return db.collection<BookingDocument>(collections.bookings).findOne({ duffelOrderId });
}

export async function listUserBookings(userId: string) {
  const db = await getDb();
  return db
    .collection<BookingDocument>(collections.bookings)
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function updateBookingStatus(
  id: string,
  update: Partial<
    Pick<
      BookingDocument,
      | "status"
      | "paymentStatus"
      | "duffelOrderId"
      | "duffelLastEventId"
      | "duffelLastEventType"
      | "duffelLastEventAt"
      | "airlineBookingReference"
      | "whopPaymentId"
      | "failureReason"
    >
  >
) {
  const db = await getDb();
  await db.collection<BookingDocument>(collections.bookings).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...update,
        updatedAt: new Date()
      }
    }
  );
}

export async function updateBookingByDuffelOrderId(
  duffelOrderId: string,
  update: Partial<
    Pick<
      BookingDocument,
      | "status"
      | "paymentStatus"
      | "duffelOrderId"
      | "duffelLastEventId"
      | "duffelLastEventType"
      | "duffelLastEventAt"
      | "airlineBookingReference"
      | "failureReason"
    >
  >
) {
  const db = await getDb();
  const result = await db.collection<BookingDocument>(collections.bookings).updateOne(
    { duffelOrderId },
    {
      $set: {
        ...update,
        updatedAt: new Date()
      }
    }
  );
  return result.matchedCount;
}

export async function listOperationalBookings(statuses: BookingStatus[]) {
  const db = await getDb();
  return db
    .collection<BookingDocument>(collections.bookings)
    .find({ status: { $in: statuses } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
}

export async function listPaymentMethods(userId: string) {
  const db = await getDb();
  return db
    .collection<PaymentMethodDocument>(collections.paymentMethods)
    .find({ userId: new ObjectId(userId), status: { $ne: "removed" } })
    .sort({ updatedAt: -1 })
    .toArray();
}
