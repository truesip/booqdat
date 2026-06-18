import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { createSessionToken, hashPassword, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { CustomerProfileDocument, UserDocument } from "@/lib/types";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
  }

  const db = await getDb();
  const email = parsed.data.email.toLowerCase();
  await db.collection<UserDocument>(collections.users).createIndex({ email: 1 }, { unique: true });

  const existing = await db.collection<UserDocument>(collections.users).findOne({ email });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const now = new Date();
  const user: UserDocument = {
    email,
    passwordHash: await hashPassword(parsed.data.password),
    role: "customer",
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<UserDocument>(collections.users).insertOne(user);
  const userId = result.insertedId;
  await db.collection<CustomerProfileDocument>(collections.profiles).insertOne({
    userId,
    fullName: parsed.data.fullName,
    createdAt: now,
    updatedAt: now
  });

  const token = await createSessionToken({ ...user, _id: userId as ObjectId });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
