import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { hashPassword } from "@/lib/auth";
import { collections, getDb } from "@/lib/mongodb";
import { hashToken } from "@/lib/security";
import type { UserDocument } from "@/lib/types";
import { passwordResetSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = passwordResetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reset request" }, { status: 400 });

  const db = await getDb();
  const tokenDoc = await db.collection(collections.passwordResetTokens).findOne({
    tokenHash: hashToken(parsed.data.token),
    usedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!tokenDoc?.userId) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  await db.collection<UserDocument>(collections.users).updateOne(
    { _id: new ObjectId(tokenDoc.userId) },
    {
      $set: {
        passwordHash: await hashPassword(parsed.data.password),
        updatedAt: new Date()
      }
    }
  );

  await db.collection(collections.passwordResetTokens).updateOne(
    { _id: tokenDoc._id },
    { $set: { usedAt: new Date() } }
  );

  return NextResponse.json({ ok: true });
}
