import { NextResponse } from "next/server";
import { getSessionClaims } from "@/lib/auth";
import { listUserBookings } from "@/lib/bookings";

export async function GET() {
  const claims = await getSessionClaims();
  if (!claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bookings = await listUserBookings(claims.sub);
  return NextResponse.json({ bookings });
}
