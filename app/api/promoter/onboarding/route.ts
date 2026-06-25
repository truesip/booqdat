import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import Whop from "@whop/sdk";
import { getSessionClaims } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import type { CustomerProfileDocument } from "@/lib/types";

async function getOnboardingLink(request: Request, companyId: string) {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not configured");
  }

  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;

  const client = new Whop({ apiKey });
  const accountLink = await client.accountLinks.create({
    company_id: companyId,
    refresh_url: `${host}/dashboard`,
    return_url: `${host}/dashboard`,
    use_case: "account_onboarding",
  });

  return accountLink.url;
}

export async function GET(request: Request) {
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
    const onboardingUrl = await getOnboardingLink(request, profile.whopCompanyId);
    return NextResponse.redirect(onboardingUrl);
  } catch (err) {
    console.error("Failed to generate onboarding link:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate onboarding link" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const onboardingUrl = await getOnboardingLink(request, profile.whopCompanyId);
    return NextResponse.json({ url: onboardingUrl });
  } catch (err) {
    console.error("Failed to generate onboarding link:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate onboarding link" },
      { status: 500 }
    );
  }
}
