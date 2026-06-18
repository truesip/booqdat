import { NextResponse } from "next/server";
import { getOffer } from "@/lib/duffel";

type RouteProps = {
  params: Promise<{ offerId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { offerId } = await params;
  const offer = await getOffer(offerId);
  return NextResponse.json({ offer });
}
