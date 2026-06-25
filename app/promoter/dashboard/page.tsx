import { getCurrentUser } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { EventDocument } from "@/lib/types";
import { PromoterDashboardClient } from "@/components/promoter-dashboard/promoter-dashboard-client";

export const dynamic = "force-dynamic";

export default async function PromoterDashboardPage() {
  const current = await getCurrentUser();
  if (!current) return null;

  const db = await getDb();
  const events = await db
    .collection<EventDocument>(collections.events)
    .find({ promoterId: current.user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // Map events to ensure they can be safely passed to Client Components (strings instead of ObjectId & Dates)
  const serializedEvents = events.map((event) => ({
    ...event,
    _id: event._id?.toString(),
    promoterId: event.promoterId.toString(),
    date: event.date.toISOString(),
    location: event.location || "",
    ticketPrice: event.ticketPrice || 0,
    ticketQuantity: event.ticketQuantity || 0,
    ticketsSold: event.ticketsSold || 0,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  }));

  return (
    <PromoterDashboardClient
      initialEvents={serializedEvents}
      promoterName={current.profile?.fullName || "Promoter"}
    />
  );
}
