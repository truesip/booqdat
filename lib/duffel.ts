import crypto from "node:crypto";
import type { NormalizedFlightOffer, PassengerInput } from "@/lib/types";

const DUFFEL_BASE_URL = process.env.DUFFEL_API_BASE_URL ?? "https://api.duffel.com";
const DUFFEL_VERSION = process.env.DUFFEL_API_VERSION ?? "v2";

type SearchInput = {
  tripType: "one-way" | "round-trip";
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
};

function getDuffelAccessToken() {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) throw new Error("DUFFEL_ACCESS_TOKEN is required for Duffel API calls.");
  return token;
}

export function verifyDuffelWebhook(body: string, headers: Headers) {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const rawSignature = headers.get("x-duffel-signature");
  if (!rawSignature) return false;

  const signatureParts = Object.fromEntries(
    rawSignature.split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key, value.join("=")];
    })
  );
  const timestamp = signatureParts.t;
  const received = signatureParts.v1;
  if (!timestamp || !received) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  try {
    const receivedBuffer = Buffer.from(received, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

async function duffelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DUFFEL_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      "Duffel-Version": DUFFEL_VERSION,
      "Authorization": `Bearer ${getDuffelAccessToken()}`,
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Duffel API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function getPlaceSuggestions(query: string) {
  if (!query || query.trim().length < 2) return [];
  const response = await duffelFetch<{ data: Array<Record<string, unknown>> }>(`/places/suggestions?query=${encodeURIComponent(query)}`);
  return response.data ?? [];
}

export async function searchFlightOffers(input: SearchInput) {

  const slices = [
    {
      origin: input.origin,
      destination: input.destination,
      departure_date: input.departureDate
    }
  ];

  if (input.tripType === "round-trip" && input.returnDate) {
    slices.push({
      origin: input.destination,
      destination: input.origin,
      departure_date: input.returnDate
    });
  }

  const payload = {
    data: {
      slices,
      passengers: Array.from({ length: input.adults }, () => ({ type: "adult" })),
      cabin_class: input.cabinClass
    }
  };

  const response = await duffelFetch<{ data: { id: string; offers?: unknown[] } }>(
    "/air/offer_requests?return_offers=true",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

  return {
    offerRequestId: response.data.id,
    offers: (response.data.offers ?? []).map(normalizeOffer)
  };
}

export async function getOffer(offerId: string) {

  const response = await duffelFetch<{ data: unknown }>(`/air/offers/${offerId}?return_available_services=true`);
  return normalizeOffer(response.data);
}

export async function createDuffelOrder({
  offer,
  passengers
}: {
  offer: NormalizedFlightOffer;
  passengers: PassengerInput[];
}) {

  const payload = {
    data: {
      selected_offers: [offer.id],
      payments: [
        {
          type: "balance",
          currency: offer.totalCurrency,
          amount: offer.totalAmount
        }
      ],
      passengers: passengers.map((passenger) => ({
        id: passenger.id,
        type: passenger.type,
        title: passenger.title,
        given_name: passenger.givenName,
        family_name: passenger.familyName,
        born_on: passenger.bornOn,
        gender: passenger.gender,
        email: passenger.email,
        phone_number: passenger.phoneNumber
      }))
    }
  };

  const response = await duffelFetch<{ data: { id: string; booking_reference: string } }>("/air/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return {
    id: response.data.id,
    bookingReference: response.data.booking_reference
  };
}

type DuffelRecord = Record<string, unknown>;

function asRecord(value: unknown): DuffelRecord {
  return typeof value === "object" && value !== null ? (value as DuffelRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function normalizeOffer(raw: unknown): NormalizedFlightOffer {
  const offer = asRecord(raw);
  const slicesRaw = asArray(offer.slices);
  const firstSlice = asRecord(slicesRaw[0]);
  const firstSegment = asRecord(asArray(firstSlice.segments)[0]);
  const firstMarketingCarrier = asRecord(firstSegment.marketing_carrier);
  const owner = asRecord(offer.owner);

  return {
    id: asStringValue(offer.id),
    expiresAt: asStringValue(offer.expires_at, undefined as unknown as string),
    totalAmount: asStringValue(offer.total_amount, "0.00"),
    totalCurrency: asStringValue(offer.total_currency, "USD"),
    baseAmount: asStringValue(offer.base_amount, undefined as unknown as string),
    taxAmount: asStringValue(offer.tax_amount, undefined as unknown as string),
    ownerName: asStringValue(owner.name, asStringValue(firstMarketingCarrier.name, "Airline")),
    ownerIataCode: asStringValue(owner.iata_code, undefined as unknown as string),
    totalEmissionsKg: asNullableString(offer.total_emissions_kg),
    slices: slicesRaw.map((sliceRaw) => {
      const slice = asRecord(sliceRaw);
      const segmentsRaw = asArray(slice.segments);
      const first = asRecord(segmentsRaw[0]);
      const last = asRecord(segmentsRaw[segmentsRaw.length - 1] ?? segmentsRaw[0]);
      const firstOrigin = asRecord(first.origin);
      const lastDestination = asRecord(last.destination);
      return {
        originCode: asStringValue(firstOrigin.iata_code, asStringValue(firstOrigin.iata_city_code)),
        originName: asStringValue(firstOrigin.city_name, asStringValue(firstOrigin.name, "Origin")),
        destinationCode: asStringValue(lastDestination.iata_code, asStringValue(lastDestination.iata_city_code)),
        destinationName: asStringValue(lastDestination.city_name, asStringValue(lastDestination.name, "Destination")),
        departingAt: asStringValue(first.departing_at),
        arrivingAt: asStringValue(last.arriving_at),
        duration: asStringValue(slice.duration, undefined as unknown as string),
        fareBrandName: asStringValue(slice.fare_brand_name, "Economy"),
        segments: segmentsRaw.map((segmentRaw) => {
          const segment = asRecord(segmentRaw);
          const operatingCarrier = asRecord(segment.operating_carrier);
          const marketingCarrier = asRecord(segment.marketing_carrier);
          const origin = asRecord(segment.origin);
          const destination = asRecord(segment.destination);
          return {
            operatingCarrierName: asStringValue(operatingCarrier.name, asStringValue(marketingCarrier.name, "Airline")),
            marketingCarrierName: asStringValue(marketingCarrier.name, undefined as unknown as string),
            flightNumber: asStringValue(segment.marketing_carrier_flight_number, undefined as unknown as string),
            originCode: asStringValue(origin.iata_code),
            destinationCode: asStringValue(destination.iata_code),
            departingAt: asStringValue(segment.departing_at),
            arrivingAt: asStringValue(segment.arriving_at),
            duration: asStringValue(segment.duration, undefined as unknown as string)
          };
        })
      };
    }),
    conditions: {
      changeBeforeDeparture: asRecord(asRecord(offer.conditions).change_before_departure).allowed
        ? "Changes may be available before departure"
        : "Change rules vary by fare",
      refundBeforeDeparture: asRecord(asRecord(offer.conditions).refund_before_departure).allowed
        ? "Refunds may be available before departure"
        : "Refund rules vary by fare"
    }
  };
}

