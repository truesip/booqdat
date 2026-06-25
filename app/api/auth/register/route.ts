import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import Whop from "@whop/sdk";
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
  const role = parsed.data.role;
  const user: UserDocument = {
    email,
    passwordHash: await hashPassword(parsed.data.password),
    role,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<UserDocument>(collections.users).insertOne(user);
  const userId = result.insertedId;

  let whopCompanyId: string | undefined = undefined;
  if (role === "promoter") {
    try {
      const apiKey = process.env.WHOP_API_KEY;
      const parentCompanyId = process.env.WHOP_COMPANY_ID;
      if (!apiKey) {
        throw new Error("WHOP_API_KEY is not configured.");
      }
      if (!parentCompanyId) {
        throw new Error("WHOP_COMPANY_ID is not configured.");
      }
      const client = new Whop({ apiKey });
      const company = await client.companies.create({
        email,
        parent_company_id: parentCompanyId,
        title: parsed.data.fullName || email,
        metadata: {
          internal_user_id: userId.toString(),
        },
      });
      whopCompanyId = company.id;
    } catch (err) {
      console.error("Failed to enroll Whop company:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to enroll with Whop payouts" }, { status: 500 });
    }
  }

  await db.collection<CustomerProfileDocument>(collections.profiles).insertOne({
    userId,
    fullName: parsed.data.fullName,
    createdAt: now,
    updatedAt: now,
    ...(whopCompanyId ? { whopCompanyId } : {})
  });

  const token = await createSessionToken({ ...user, _id: userId as ObjectId });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
