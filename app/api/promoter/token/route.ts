import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import Whop from "@whop/sdk";
import { getSessionClaims } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { CustomerProfileDocument } from "@/lib/types";

async function getPromoterToken(companyId: string) {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not configured");
  }

  const client = new Whop({ apiKey });
  const { token } = await client.accessTokens.create({
    company_id: companyId,
  });

  return token;
}

export async function POST() {
  const claims = await getSessionClaims();
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userId = new ObjectId(claims.sub);
  const profile = await db.collection<CustomerProfileDocument>(collections.profiles).findOne({ userId });
  if (!profile || !profile.whopCompanyId) {
    return NextResponse.json({ error: "Promoter Whop company not found" }, { status: 404 });
  }

  try {
    const token = await getPromoterToken(profile.whopCompanyId);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Failed to generate promoter token:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const claims = await getSessionClaims();
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userId = new ObjectId(claims.sub);
  const profile = await db.collection<CustomerProfileDocument>(collections.profiles).findOne({ userId });
  if (!profile || !profile.whopCompanyId) {
    return NextResponse.json({ error: "Promoter Whop company not found" }, { status: 404 });
  }

  try {
    const token = await getPromoterToken(profile.whopCompanyId);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Failed to generate promoter token:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}
