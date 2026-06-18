import { NextResponse } from "next/server";
import { getPlaceSuggestions } from "@/lib/duffel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const data = await getPlaceSuggestions(query);
    // Map Duffel response to a simpler format for our autocomplete dropdown
    const suggestions = data.map((place: Record<string, unknown>) => ({
      id: String(place.id ?? ""),
      type: (place.type === "airport" ? "airport" : "city") as "airport" | "city",
      iataCode: String(place.iata_code ?? ""),
      name: String(place.name ?? ""),
      cityName: String(place.city_name ?? ""),
      countryCode: String(place.iata_country_code ?? ""),
    }));
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Place suggestion error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
