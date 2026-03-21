
function normalizeText(value) {
  return String(value || "").trim();
}
function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function clampInteger(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
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
function resolveNyvapayTimeoutMs(env) {
  const configured = toPositiveInteger(env?.nyvapayTimeoutMs, 8000);
  return clampInteger(configured, 2000, 20000);
}

function resolveNyvapayMaxAttempts(env) {
  const configured = toPositiveInteger(env?.nyvapayMaxAttempts, 2);
  return clampInteger(configured, 1, 2);
}

function isRetryableGatewayStatus(status) {
  return [502, 503, 504].includes(gatewayStatusOrDefault(status));
}

async function requestNyvapayPaymentLink(url, env, paymentLinkPayload) {
  const timeoutMs = resolveNyvapayTimeoutMs(env);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Merchant-Email": normalizeText(env.nyvapayMerchantEmail),
        "X-API-Key": normalizeText(env.nyvapayApiKey)
      },
      body: JSON.stringify(paymentLinkPayload || {}),
      signal: controller.signal
    });
    return { ok: true, response };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        error: "NYVAPAY request timed out. Please try again."
      };
    }
    return {
      ok: false,
      status: 503,
      error: "NYVAPAY is currently unavailable. Please try again."
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function parseGatewayPayload(response) {
  const contentType = normalizeText(response.headers.get("content-type")).toLowerCase();
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  const textBody = await response.text().catch(() => "");
  const normalizedTextBody = normalizeText(textBody);
  if (!normalizedTextBody) return null;
  const embeddedUrlMatch = normalizedTextBody.match(/https?:\/\/[^\s"'<>]+/i);
  const embeddedUrl = normalizeText(embeddedUrlMatch?.[0]);
  if (isHttpUrl(normalizedTextBody)) {
    return { payment_url: normalizedTextBody };
  }
  if (isHttpUrl(embeddedUrl)) {
    return { payment_url: embeddedUrl };
  }
  return { error: normalizedTextBody };
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
  const maxAttempts = resolveNyvapayMaxAttempts(env);
  let latestFailure = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const requestResult = await requestNyvapayPaymentLink(url, env, paymentLinkPayload);
    if (!requestResult.ok) {
      latestFailure = {
        ok: false,
        status: requestResult.status || 503,
        error: requestResult.error || "NYVAPAY is currently unavailable. Please try again."
      };
      if (attempt < maxAttempts && isRetryableGatewayStatus(requestResult.status)) continue;
      return latestFailure;
    }

    const response = requestResult.response;
    const payload = await parseGatewayPayload(response);
    if (!response.ok) {
      const gatewayMessage = resolveGatewayErrorMessage(payload);
      latestFailure = {
        ok: false,
        status: gatewayStatusOrDefault(response.status),
        error: gatewayMessage || `NYVAPAY request failed (${response.status})`,
        payload
      };
      if (attempt < maxAttempts && isRetryableGatewayStatus(response.status)) continue;
      return latestFailure;
    }

    const paymentUrl = extractPaymentUrl(payload);
    if (!paymentUrl) {
      latestFailure = {
        ok: false,
        status: 502,
        error: "NYVAPAY response did not include a payment URL",
        payload
      };
      if (attempt < maxAttempts) continue;
      return latestFailure;
    }

    return {
      ok: true,
      status: 200,
      paymentUrl,
      linkId: extractLinkId(payload),
      payload
    };
  }
  return latestFailure || {
    ok: false,
    status: 503,
    error: "NYVAPAY is currently unavailable. Please try again."
  };
}

module.exports = {
  isNyvapayConfigured,
  createNyvapayPaymentLink,
  extractPaymentUrl,
  extractLinkId
};
