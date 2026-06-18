import { NextResponse } from "next/server";
import { getBookingByDuffelOrderId, updateBookingByDuffelOrderId } from "@/lib/bookings";
import { verifyDuffelWebhook } from "@/lib/duffel";
import { collections, getDb } from "@/lib/mongodb";
import type { BookingDocument } from "@/lib/types";

type DuffelWebhookEvent = {
  id?: string;
  api_version?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown> | null;
  } | null;
  live_mode?: boolean;
  idempotency_key?: string;
  created_at?: string;
};

type BookingUpdate = Partial<
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
>;

export async function POST(request: Request) {
  const bodyText = await request.text();
  if (!verifyDuffelWebhook(bodyText, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: DuffelWebhookEvent;
  try {
    event = JSON.parse(bodyText) as DuffelWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventType = event.type ?? "unknown";
  const eventId = event.id ? `duffel:${event.id}` : `duffel:${eventType}:${event.idempotency_key ?? Date.now()}`;
  const eventAt = parseDate(event.created_at);
  const db = await getDb();

  const existing = await db.collection(collections.webhookEvents).findOne({ eventId });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  await db.collection(collections.webhookEvents).insertOne({
    eventId,
    provider: "duffel",
    type: eventType,
    payload: event,
    createdAt: new Date()
  });

  if (eventType === "ping.triggered") {
    return NextResponse.json({ ok: true, ping: true });
  }

  const object = asRecord(event.data?.object);
  const duffelOrderId = extractDuffelOrderId(event, object);
  if (!duffelOrderId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "No Duffel order ID on event" });
  }

  const booking = await getBookingByDuffelOrderId(duffelOrderId);
  if (!booking) {
    return NextResponse.json({ ok: true, ignored: true, reason: "No matching booking" });
  }

  const update = buildBookingUpdate(eventType, eventId, eventAt, duffelOrderId, object);
  if (!update) {
    return NextResponse.json({ ok: true, ignored: true, reason: "Unhandled Duffel event type" });
  }

  await updateBookingByDuffelOrderId(duffelOrderId, update);
  await db.collection(collections.webhookEvents).updateOne(
    { eventId },
    {
      $set: {
        bookingId: booking._id?.toString(),
        processedAt: new Date(),
        appliedStatus: update.status,
        appliedPaymentStatus: update.paymentStatus
      }
    }
  );

  return NextResponse.json({ ok: true });
}

function buildBookingUpdate(
  eventType: string,
  eventId: string,
  eventAt: Date | undefined,
  duffelOrderId: string,
  object: Record<string, unknown>
): BookingUpdate | null {
  const common: BookingUpdate = {
    duffelOrderId,
    duffelLastEventId: eventId,
    duffelLastEventType: eventType,
    duffelLastEventAt: eventAt ?? new Date()
  };
  const airlineBookingReference = extractBookingReference(object);
  if (airlineBookingReference) common.airlineBookingReference = airlineBookingReference;

  switch (eventType) {
    case "order.created":
    case "air.order.changed":
      return {
        ...common,
        status: "confirmed",
        paymentStatus: "succeeded"
      };
    case "order.creation_failed":
      return {
        ...common,
        status: "ticketing_failed",
        failureReason: extractFailureReason(object, "Duffel order creation failed")
      };
    case "order.airline_initiated_change_detected":
      return {
        ...common,
        status: "requires_manual_review",
        failureReason: "Airline-initiated flight change detected. Review the order in Duffel before notifying the customer."
      };
    case "order_cancellation.created":
      return {
        ...common,
        status: "requires_manual_review",
        failureReason: "Duffel order cancellation created. Review refund and customer communication before closing the booking."
      };
    case "order_cancellation.confirmed":
      if (shouldMarkRefunded(object)) {
        return {
          ...common,
          status: "cancelled",
          paymentStatus: "refunded"
        };
      }
      return {
        ...common,
        status: "cancelled"
      };
    case "air.payment.pending":
      return {
        ...common,
        status: "ticketing_in_progress",
        paymentStatus: "pending"
      };
    case "air.payment.succeeded":
      return {
        ...common,
        status: "confirmed",
        paymentStatus: "succeeded"
      };
    case "air.payment.failed":
    case "air.payment.cancelled":
      return {
        ...common,
        status: "requires_manual_review",
        paymentStatus: "failed",
        failureReason: extractFailureReason(object, "Duffel payment failed or was cancelled")
      };
    default:
      return null;
  }
}

function extractDuffelOrderId(event: DuffelWebhookEvent, object: Record<string, unknown>) {
  const objectId = asString(object.id);
  if (objectId?.startsWith("ord_")) return objectId;

  const orderId = asString(object.order_id);
  if (orderId) return orderId;

  const nestedOrderId = asString(asRecord(object.order).id);
  if (nestedOrderId) return nestedOrderId;

  const idempotencyKey = asString(event.idempotency_key);
  if (idempotencyKey?.startsWith("ord_")) return idempotencyKey;

  return null;
}

function extractBookingReference(object: Record<string, unknown>) {
  const bookingReference = asString(object.booking_reference);
  if (bookingReference) return bookingReference;

  const firstReference = asRecord(asArray(object.booking_references)[0]);
  return asString(firstReference.booking_reference) ?? asString(firstReference.reference);
}

function extractFailureReason(object: Record<string, unknown>, fallback: string) {
  return (
    asString(object.failure_reason) ??
    asString(object.failure_message) ??
    asString(object.message) ??
    asString(asRecord(object.error).message) ??
    fallback
  );
}

function shouldMarkRefunded(object: Record<string, unknown>) {
  return Boolean(asString(object.refund_amount) ?? asString(object.amount) ?? object.refund_amount);
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.length ? value : undefined;
}
