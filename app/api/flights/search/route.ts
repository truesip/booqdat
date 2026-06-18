import { NextResponse } from "next/server";
import { searchFlightOffers } from "@/lib/duffel";
import { flightSearchSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = flightSearchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid flight search" }, { status: 400 });

  const result = await searchFlightOffers(parsed.data);
  return NextResponse.json(result);
}
