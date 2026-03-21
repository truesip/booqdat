
function normalizeText(value) {
  return String(value || "").trim();
}

function isHttpUrl(value) {
  const text = normalizeText(value);
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function gatewayStatusOrDefault(status) {
  const parsed = Number(status);
  if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) return parsed;
  return 502;
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
  if (!payload) return "";
  if (typeof payload === "string" && isHttpUrl(payload)) return payload;
  if (typeof payload !== "object") return "";
  const directKeys = [
    "payment_url",
    "paymentUrl",
    "payment_link",
    "paymentLink",
    "payment_page_url",
    "paymentPageUrl",
    "checkout_url",
    "checkoutUrl",
    "url",
    "link_url",
    "linkUrl",
    "short_url",
    "shortUrl"
  ];
  for (const key of directKeys) {
    const value = normalizeText(payload[key]);
    if (value) return value;
  }

  if (typeof payload.link === "string" && isHttpUrl(payload.link)) {
    return payload.link;
  }
  if (payload.link && typeof payload.link === "object") {
    const nested = extractPaymentUrl(payload.link);
    if (nested) return nested;
  }
  if (typeof payload.data === "string" && isHttpUrl(payload.data)) {
    return payload.data;
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
    const normalizedTextBody = normalizeText(textBody);
    if (normalizedTextBody) {
      const embeddedUrlMatch = normalizedTextBody.match(/https?:\/\/[^\s"'<>]+/i);
      const embeddedUrl = normalizeText(embeddedUrlMatch?.[0]);
      if (isHttpUrl(normalizedTextBody)) {
        payload = { payment_url: normalizedTextBody };
      } else if (isHttpUrl(embeddedUrl)) {
        payload = { payment_url: embeddedUrl };
      } else {
        payload = { error: normalizedTextBody };
      }
    }
  }

  if (!response.ok) {
    const gatewayMessage = resolveGatewayErrorMessage(payload);
    return {
      ok: false,
      status: gatewayStatusOrDefault(response.status),
      error: gatewayMessage || `NYVAPAY request failed (${response.status})`,
      payload
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
