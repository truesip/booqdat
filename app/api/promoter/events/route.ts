import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { EventDocument } from "@/lib/types";

export async function GET() {
  const current = await getCurrentUser();
  if (!current || current.user.role !== "promoter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const events = await db
    .collection<EventDocument>(collections.events)
    .find({ promoterId: current.user._id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.user.role !== "promoter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { title, description, date, location, latitude, longitude, ticketPrice, ticketQuantity } = data;

    if (!title || !description || !date || !location || ticketPrice === undefined || ticketQuantity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    
    const newEvent: EventDocument = {
      promoterId: current.user._id,
      title,
      description,
      date: new Date(date),
      location,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      ticketPrice: Number(ticketPrice),
      ticketQuantity: Number(ticketQuantity),
      ticketsSold: 0,
      whopCompanyId: current.user.whopCompanyId,
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection<EventDocument>(collections.events).insertOne(newEvent);

    return NextResponse.json({ ok: true, eventId: result.insertedId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.user.role !== "promoter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { id, title, description, date, location, latitude, longitude, ticketPrice, ticketQuantity } = data;

    if (!id || !title || !description || !date || !location || ticketPrice === undefined || ticketQuantity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await getDb();
    const eventId = new ObjectId(id);

    const existing = await db.collection<EventDocument>(collections.events).findOne({
      _id: eventId,
      promoterId: current.user._id
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 404 });
    }

    const updateData: Partial<EventDocument> = {
      title,
      description,
      date: new Date(date),
      location,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      ticketPrice: Number(ticketPrice),
      ticketQuantity: Number(ticketQuantity),
      updatedAt: new Date()
    };

    await db.collection<EventDocument>(collections.events).updateOne(
      { _id: eventId },
      { $set: updateData }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to update event";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.user.role !== "promoter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection<EventDocument>(collections.events).deleteOne({
      _id: new ObjectId(id),
      promoterId: current.user._id
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to delete event";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
