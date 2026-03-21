const KNOWN_FAILURE_STATUSES = new Set([400, 401, 403, 404, 500, 502, 503]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizedBaseUrl(env) {
  const configured = normalizeText(env?.nyvapayBaseUrl);
  const baseUrl = configured || "https://nyvapay.com";
  return baseUrl.replace(/\/+$/, "");
}

function isNyvapayConfigured(env) {
  return Boolean(
    normalizeText(env?.nyvapayMerchantEmail) &&
    normalizeText(env?.nyvapayApiKey)
  );
}

function resolveGatewayErrorMessage(payload) {
  if (payload && typeof payload === "object" && normalizeText(payload.error)) {
    return normalizeText(payload.error);
  }
  return "";
}

function extractPaymentUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  const directKeys = [
    "payment_url",
    "paymentUrl",
    "checkout_url",
    "checkoutUrl",
    "url",
    "short_url",
    "shortUrl"
  ];
  for (const key of directKeys) {
    const value = normalizeText(payload[key]);
    if (value) return value;
  }

  if (payload.link && typeof payload.link === "object") {
    const nested = extractPaymentUrl(payload.link);
    if (nested) return nested;
  }
  if (payload.data && typeof payload.data === "object") {
    const nested = extractPaymentUrl(payload.data);
    if (nested) return nested;
  }

  return "";
}

function extractLinkId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const directKeys = ["id", "link_id", "linkId", "payment_link_id", "paymentLinkId"];
  for (const key of directKeys) {
    const value = normalizeText(payload[key]);
    if (value) return value;
  }
  if (payload.link && typeof payload.link === "object") {
    const nested = extractLinkId(payload.link);
    if (nested) return nested;
  }
  if (payload.data && typeof payload.data === "object") {
    const nested = extractLinkId(payload.data);
    if (nested) return nested;
  }
  return "";
}

async function createNyvapayPaymentLink(env, paymentLinkPayload) {
  if (!isNyvapayConfigured(env)) {
    return {
      ok: false,
      status: 503,
      error: "NYVAPAY credentials are not configured"
    };
  }

  const url = `${normalizedBaseUrl(env)}/api/merchant/payment-links`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Merchant-Email": normalizeText(env.nyvapayMerchantEmail),
        "X-API-Key": normalizeText(env.nyvapayApiKey)
      },
      body: JSON.stringify(paymentLinkPayload || {})
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: "NYVAPAY is currently unavailable. Please try again."
    };
  }

  let payload = null;
  const contentType = normalizeText(response.headers.get("content-type")).toLowerCase();
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const textBody = await response.text().catch(() => "");
    if (normalizeText(textBody)) {
      payload = { error: normalizeText(textBody) };
    }
  }

  if (!response.ok) {
    const gatewayMessage = resolveGatewayErrorMessage(payload);
    return {
      ok: false,
      status: KNOWN_FAILURE_STATUSES.has(response.status) ? response.status : 502,
      error: gatewayMessage || `NYVAPAY request failed (${response.status})`
    };
  }

  const paymentUrl = extractPaymentUrl(payload);
  if (!paymentUrl) {
    return {
      ok: false,
      status: 502,
      error: "NYVAPAY response did not include a payment URL",
      payload
    };
  }

  return {
    ok: true,
    status: 200,
    paymentUrl,
    linkId: extractLinkId(payload),
    payload
  };
}

module.exports = {
  isNyvapayConfigured,
  createNyvapayPaymentLink,
  extractPaymentUrl,
  extractLinkId
};
