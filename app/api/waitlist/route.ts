import { NextResponse } from "next/server";
import { collections, getDb } from "@/lib/mongodb";
import { waitlistSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries((await request.formData()).entries());

  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid waitlist request" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection(collections.waitlistLeads).updateOne(
    { email: parsed.data.email.toLowerCase(), vertical: parsed.data.vertical },
    {
      $set: {
        email: parsed.data.email.toLowerCase(),
        vertical: parsed.data.vertical,
        note: parsed.data.note,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  if (contentType.includes("application/json")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL(`/coming-soon/${parsed.data.vertical}?joined=1`, request.url));
}
