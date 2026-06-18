import crypto from "node:crypto";

const WHOP_BASE_URL = process.env.WHOP_API_BASE_URL ?? "https://api.whop.com/api/v1";
function getWhopApiKey() {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error("WHOP_API_KEY is required for Whop API calls.");
  return apiKey;
}

function getWhopCompanyId() {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) throw new Error("WHOP_COMPANY_ID is required for Whop checkout configuration.");
  return companyId;
}

async function whopFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WHOP_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getWhopApiKey()}`,
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

  const response = await whopFetch<{
    id: string;
    purchase_url?: string;
    plan?: { id?: string };
  }>("/checkout_configurations", {
    method: "POST",
    body: JSON.stringify({
      plan: {
        company_id: getWhopCompanyId(),
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
