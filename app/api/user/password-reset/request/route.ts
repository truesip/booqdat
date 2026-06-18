import { NextResponse } from "next/server";
import { collections, getDb } from "@/lib/mongodb";
import { createPlainToken, hashToken } from "@/lib/security";
import type { UserDocument } from "@/lib/types";
import { passwordResetRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = passwordResetRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const db = await getDb();
  const user = await db
    .collection<UserDocument>(collections.users)
    .findOne({ email: parsed.data.email.toLowerCase() });

  let resetUrl: string | undefined;

  if (user?._id) {
    const token = createPlainToken();
    await db.collection(collections.passwordResetTokens).insertOne({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      usedAt: null,
      createdAt: new Date()
    });
    resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  }

  return NextResponse.json({
    ok: true,
    resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl
  });
}
