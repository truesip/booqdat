function normalizeText(value) {
  return String(value || "").trim();
}

function truncateText(value, maxLength = 240) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
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

function normalizeUrlForComparison(value) {
  const text = normalizeText(value);
  if (!isHttpUrl(text)) return "";
  try {
    const parsed = new URL(text);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function sanitizeUrlForLog(value) {
  const text = normalizeText(value);
  if (!isHttpUrl(text)) return truncateText(text);
  try {
    const parsed = new URL(text);
    for (const [key] of parsed.searchParams.entries()) {
      if (/(token|secret|key|sig|auth|password)/i.test(key)) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    return truncateText(parsed.toString());
  } catch {
    return truncateText(text);
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
  if (!payload || typeof payload !== "object") return "";
  const direct = [
    payload.error,
    payload.message,
    payload.detail,
    payload.description,
    payload?.data?.error,
    payload?.data?.message,
    payload?.link?.error,
    payload?.link?.message
  ];
  for (const candidate of direct) {
    const text = normalizeText(candidate);
    if (text) return text;
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

function buildExcludedUrlSet(paymentLinkPayload) {
  const excluded = new Set();
  if (!paymentLinkPayload || typeof paymentLinkPayload !== "object") return excluded;
  const candidates = [
    paymentLinkPayload.webhook_url,
    paymentLinkPayload.success_redirect_url,
    paymentLinkPayload.cancel_redirect_url,
    paymentLinkPayload.return_url
  ];
  for (const candidate of candidates) {
    const normalized = normalizeUrlForComparison(candidate);
    if (normalized) excluded.add(normalized);
  }
  return excluded;
}

function isPaymentLikeKey(keyPath) {
  const key = normalizeText(keyPath).toLowerCase();
  return /(payment|checkout|pay|invoice|link|hosted|approval|authorize)/.test(key);
}

function isStrongPaymentKey(keyPath) {
  const key = normalizeText(keyPath).toLowerCase();
  return /(^|\.)(payment_url|paymenturl|payment_link|paymentlink|checkout_url|checkouturl|payment_page_url|paymentpageurl|hosted_url|hostedurl|invoice_url|invoiceurl|pay_url|payurl)$/.test(key);
}

function isBlockedContextKey(keyPath) {
  const key = normalizeText(keyPath).toLowerCase();
  return /(webhook|callback|notify|return|cancel|success_redirect|redirect_success)/.test(key);
}

function collectUrlCandidates(value, candidates, keyPath = "", depth = 0, seen = new Set()) {
  if (value == null || depth > 8 || candidates.length >= 60) return;
  if (typeof value === "string") {
    const url = normalizeText(value);
    if (isHttpUrl(url)) {
      candidates.push({ url, keyPath });
    }
    return;
  }
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectUrlCandidates(value[index], candidates, `${keyPath}[${index}]`, depth + 1, seen);
      if (candidates.length >= 60) break;
    }
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    collectUrlCandidates(nested, candidates, nextPath, depth + 1, seen);
    if (candidates.length >= 60) break;
  }
}

function scorePaymentUrlCandidate(candidate, excludedUrls) {
  const normalizedCandidate = normalizeUrlForComparison(candidate.url);
  if (!normalizedCandidate || excludedUrls.has(normalizedCandidate)) return Number.NEGATIVE_INFINITY;
  try {
    const parsed = new URL(candidate.url);
    const keyPath = normalizeText(candidate.keyPath).toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    let score = 0;
    if (isStrongPaymentKey(keyPath)) score += 120;
    if (isPaymentLikeKey(keyPath)) score += 60;
    if (keyPath.endsWith(".url") || keyPath === "url") score += 5;
    if (isBlockedContextKey(keyPath) && !isPaymentLikeKey(keyPath)) score -= 120;
    if (host.includes("nyva")) score += 30;
    if (/(payment|checkout|invoice|pay|link)/.test(path)) score += 20;
    if (/(webhook|callback)/.test(path)) score -= 120;
    return score;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

function findBestCandidateUrl(payload, excludedUrls) {
  const candidates = [];
  collectUrlCandidates(payload, candidates);
  let best = { score: Number.NEGATIVE_INFINITY, url: "" };
  for (const candidate of candidates) {
    const score = scorePaymentUrlCandidate(candidate, excludedUrls);
    if (score > best.score) {
      best = { score, url: candidate.url };
    }
  }
  if (best.score < 40) return "";
  return best.url;
}

function summarizePayloadForDebug(payload, excludedUrls) {
  const payloadType = payload == null ? "null" : Array.isArray(payload) ? "array" : typeof payload;
  if (payloadType !== "object" && payloadType !== "array") {
    return {
      payloadType,
      preview: truncateText(payload)
    };
  }
  const topLevelKeys = payloadType === "object"
    ? Object.keys(payload).slice(0, 20)
    : [];
  const candidates = [];
  collectUrlCandidates(payload, candidates);
  const urlCandidates = candidates
    .map((candidate) => ({
      keyPath: truncateText(candidate.keyPath, 120),
      url: sanitizeUrlForLog(candidate.url),
      score: scorePaymentUrlCandidate(candidate, excludedUrls)
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return {
    payloadType,
    topLevelKeys,
    urlCandidates
  };
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

function extractPaymentUrl(payload, options = {}) {
  if (!payload) return "";
  const excludedUrls = options.excludedUrls instanceof Set ? options.excludedUrls : new Set();
  if (typeof payload === "string") {
    const candidate = normalizeText(payload);
    const normalizedCandidate = normalizeUrlForComparison(candidate);
    if (normalizedCandidate && !excludedUrls.has(normalizedCandidate)) return candidate;
    return "";
  }
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
    "hosted_url",
    "hostedUrl",
    "invoice_url",
    "invoiceUrl",
    "pay_url",
    "payUrl",
    "link_url",
    "linkUrl",
    "short_url",
    "shortUrl",
    "redirect_url",
    "redirectUrl",
    "url"
  ];

  for (const key of directKeys) {
    const value = normalizeText(payload[key]);
    const normalized = normalizeUrlForComparison(value);
    if (normalized && !excludedUrls.has(normalized)) {
      const score = scorePaymentUrlCandidate({ url: value, keyPath: key }, excludedUrls);
      if (score >= 40) return value;
    }
  }

  if (typeof payload.link === "string") {
    const normalized = normalizeUrlForComparison(payload.link);
    if (normalized && !excludedUrls.has(normalized)) return payload.link;
  }

  return findBestCandidateUrl(payload, excludedUrls);
}

function extractLinkId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const directKeys = ["id", "link_id", "linkId", "payment_link_id", "paymentLinkId", "reference", "reference_id"];
  for (const key of directKeys) {
    const value = normalizeText(payload[key]);
    if (value) return value;
  }
  const nestedObjects = [payload.link, payload.data, payload.payment, payload.result];
  for (const nested of nestedObjects) {
    if (nested && typeof nested === "object") {
      const nestedValue = extractLinkId(nested);
      if (nestedValue) return nestedValue;
    }
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
  const excludedUrls = buildExcludedUrlSet(paymentLinkPayload);
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
    const payloadInfo = summarizePayloadForDebug(payload, excludedUrls);

    if (!response.ok) {
      const gatewayMessage = resolveGatewayErrorMessage(payload);
      latestFailure = {
        ok: false,
        status: gatewayStatusOrDefault(response.status),
        error: gatewayMessage || `NYVAPAY request failed (${response.status})`,
        payload,
        payloadInfo
      };
      if (attempt < maxAttempts && isRetryableGatewayStatus(response.status)) continue;
      return latestFailure;
    }

    const paymentUrl = extractPaymentUrl(payload, { excludedUrls });
    if (!paymentUrl) {
      latestFailure = {
        ok: false,
        status: 502,
        error: "NYVAPAY response did not include a payment URL",
        payload,
        payloadInfo
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
