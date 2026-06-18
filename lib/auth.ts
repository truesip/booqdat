import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { ObjectId } from "mongodb";
import { collections, getDb } from "@/lib/mongodb";
import type { CustomerProfileDocument, UserDocument, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "booqdat_session";

type SessionClaims = {
  sub: string;
  email: string;
  role: UserRole;
};

function getAuthSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-change-this-secret");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: UserDocument & { _id: ObjectId }) {
  return new SignJWT({
    email: user.email,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user._id.toString())
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token?: string): Promise<SessionClaims | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as UserRole
    };
  } catch {
    return null;
  }
}

export async function getSessionClaims() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser() {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const db = await getDb().catch(() => null);
  if (!db) return null;

  const user = await db
    .collection<UserDocument>(collections.users)
    .findOne({ _id: new ObjectId(claims.sub) });

  if (!user?._id) return null;

  const profile = await db
    .collection<CustomerProfileDocument>(collections.profiles)
    .findOne({ userId: user._id });

  return { user: { ...user, _id: user._id }, profile };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}
