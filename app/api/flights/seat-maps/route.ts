import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId");
  if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });

  const DUFFEL_BASE_URL = process.env.DUFFEL_API_BASE_URL ?? "https://api.duffel.com";
  const DUFFEL_VERSION = process.env.DUFFEL_API_VERSION ?? "v2";
  const token = process.env.DUFFEL_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "DUFFEL_ACCESS_TOKEN is not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${DUFFEL_BASE_URL}/air/seat_maps?offer_id=${offerId}`, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Duffel-Version": DUFFEL_VERSION,
        "Authorization": `Bearer ${token}`
      },
      cache: "no-store"
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Duffel API error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
