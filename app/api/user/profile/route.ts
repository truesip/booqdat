import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionClaims } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { CustomerProfileDocument, UserDocument } from "@/lib/types";
import { profileSchema } from "@/lib/validators";

export async function GET() {
  const claims = await getSessionClaims();
  if (!claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userId = new ObjectId(claims.sub);
  const profile = await db.collection<CustomerProfileDocument>(collections.profiles).findOne({ userId });
  const user = await db.collection<UserDocument>(collections.users).findOne({ _id: userId });
  return NextResponse.json({ email: user?.email, profile });
}

export async function PUT(request: Request) {
  const claims = await getSessionClaims();
  if (!claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });

  const db = await getDb();
  const userId = new ObjectId(claims.sub);
  const now = new Date();
  const { email, ...profile } = parsed.data;

  if (email.toLowerCase() !== claims.email.toLowerCase()) {
    const existing = await db.collection<UserDocument>(collections.users).findOne({ email: email.toLowerCase() });
    if (existing && existing._id?.toString() !== claims.sub) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    await db.collection<UserDocument>(collections.users).updateOne(
      { _id: userId },
      { $set: { email: email.toLowerCase(), updatedAt: now } }
    );
  }

  await db.collection<CustomerProfileDocument>(collections.profiles).updateOne(
    { userId },
    {
      $set: {
        ...profile,
        updatedAt: now
      },
      $setOnInsert: {
        userId,
        createdAt: now
      }
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
