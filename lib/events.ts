import { ObjectId } from "mongodb";
import { collections, getDb } from "./mongodb";
import type { EventDocument } from "./types";

export async function getEvents({
  city,
  date,
  maxPrice
}: {
  city?: string;
  date?: string;
  maxPrice?: string;
} = {}) {
  const db = await getDb();
  
  // Seed mock events if collection is empty
  const count = await db.collection(collections.events).countDocuments();
  if (count === 0) {
    const mockPromoterId = new ObjectId();
    const mockEvents: EventDocument[] = [
      {
        promoterId: mockPromoterId,
        title: "Desert Skyline Sessions",
        description: "An evening of deep house and desert views under the stars.",
        category: "Music",
        tags: ["festival", "nightlife", "rooftop"],
        date: new Date("2026-07-15T20:00:00Z"),
        time: "20:00",
        venueType: "Physical",
        venue: "Sandia Peak Amphitheater",
        city: "Albuquerque",
        state: "NM",
        country: "United States",
        capacity: 500,
        gaPrice: 45,
        gaQty: 400,
        vipPrice: 120,
        vipQty: 100,
        banner: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        promoterId: mockPromoterId,
        title: "Metropolitan Jazz Night",
        description: "Intimate acoustic jazz performance featuring premier local quartets.",
        category: "Music",
        tags: ["jazz", "nightlife", "acoustic"],
        date: new Date("2026-08-01T19:30:00Z"),
        time: "19:30",
        venueType: "Physical",
        venue: "Blue Note Club",
        city: "New York",
        state: "NY",
        country: "United States",
        capacity: 150,
        gaPrice: 35,
        gaQty: 120,
        vipPrice: 90,
        vipQty: 30,
        banner: "https://images.unsplash.com/photo-1486591978090-58e619d37fe7?auto=format&fit=crop&w=800&q=80",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        promoterId: mockPromoterId,
        title: "Hollywood Comedy Showcase",
        description: "Top-tier standup comedians live in the heart of Hollywood.",
        category: "Comedy",
        tags: ["standup", "comedy", "showcase"],
        date: new Date("2026-07-22T21:00:00Z"),
        time: "21:00",
        venueType: "Physical",
        venue: "The Laugh Factory",
        city: "Los Angeles",
        state: "CA",
        country: "United States",
        capacity: 250,
        gaPrice: 25,
        gaQty: 200,
        vipPrice: 60,
        vipQty: 50,
        banner: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=800&q=80",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    await db.collection(collections.events).insertMany(mockEvents);
  }

  const query: {
    city?: { $regex: RegExp };
    date?: { $gte: Date; $lte: Date };
    gaPrice?: { $lte: number };
  } = {};

  if (city && city.trim() !== "") {
    query.city = { $regex: new RegExp(city.trim(), "i") };
  }

  if (date && date.trim() !== "") {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  if (maxPrice && maxPrice.trim() !== "") {
    const priceNum = parseFloat(maxPrice);
    if (!isNaN(priceNum)) {
      query.gaPrice = { $lte: priceNum };
    }
  }

  return db
    .collection<EventDocument>(collections.events)
    .find(query)
    .sort({ date: 1 })
    .toArray();
}

export async function getEventById(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection<EventDocument>(collections.events).findOne({ _id: new ObjectId(id) });
}
