import crypto from "node:crypto";

const WHOP_BASE_URL = process.env.WHOP_API_BASE_URL ?? "https://api.whop.com/api/v1";

function isMockMode() {
  return process.env.WHOP_MOCK_MODE === "true" || !process.env.WHOP_API_KEY || !process.env.WHOP_COMPANY_ID;
}

async function whopFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WHOP_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.WHOP_API_KEY}`,
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Whop API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function createWhopCheckoutConfiguration({
  bookingId,
  amount,
  currency,
  customerEmail,
  metadata
}: {
  bookingId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  metadata: Record<string, string>;
}) {
  if (isMockMode()) {
    return {
      id: `ch_mock_${bookingId}`,
      planId: `plan_mock_${bookingId}`,
      purchaseUrl: `/booking/${bookingId}/status?mockPayment=1`
    };
  }

  const response = await whopFetch<{
    id: string;
    purchase_url?: string;
    plan?: { id?: string };
  }>("/checkout_configurations", {
    method: "POST",
    body: JSON.stringify({
      plan: {
        company_id: process.env.WHOP_COMPANY_ID,
        initial_price: amount,
        currency: currency.toLowerCase(),
        plan_type: "one_time"
      },
      metadata: {
        ...metadata,
        bookingId,
        customerEmail
      }
    })
  });

  return {
    id: response.id,
    planId: response.plan?.id,
    purchaseUrl: response.purchase_url
  };
}

export function verifyWhopWebhook(body: string, headers: Headers) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return true;

  const received =
    headers.get("x-whop-signature") ??
    headers.get("whop-signature") ??
    headers.get("x-signature");

  if (!received) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}
