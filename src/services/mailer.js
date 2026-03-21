function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeEmail(item)).filter(Boolean);
  }
  const single = normalizeEmail(value);
  return single ? [single] : [];
}

function normalizedApiBaseUrl(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function buildSender(env) {
  const fromAddress = normalizeText(env.mailFrom);
  const fromName = normalizeText(env.mailFromName);
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

function isMailerConfigured(env) {
  return Boolean(
    normalizeText(env.smtp2goApiBaseUrl) &&
    normalizeText(env.smtp2goApiKey) &&
    normalizeText(env.mailFrom)
  );
}

function resolveApiErrorMessage(payload, fallback) {
  const candidates = [
    payload?.data?.error,
    payload?.data?.message,
    payload?.error,
    payload?.message,
    fallback
  ];
  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    if (text) return text;
  }
  return "SMTP2GO API request failed";
}

async function sendEmail(env, payload) {
  const recipients = resolveRecipients(payload?.to);
  if (!recipients.length) {
    return { ok: false, skipped: true, reason: "missing-recipient" };
  }
  if (!isMailerConfigured(env)) {
    return { ok: false, skipped: true, reason: "smtp2go-not-configured" };
  }

  const apiBaseUrl = normalizedApiBaseUrl(env.smtp2goApiBaseUrl || "https://api.smtp2go.com/v3");
  const endpoint = `${apiBaseUrl}/email/send`;
  const replyTo = normalizeEmail(payload?.replyTo || env.mailReplyTo || "");
  const sender = buildSender(env);

  const requestBody = {
    sender,
    to: recipients,
    subject: normalizeText(payload?.subject || "BOOQDAT Notification"),
    text_body: String(payload?.text || ""),
    html_body: String(payload?.html || "")
  };
  if (isValidEmail(replyTo)) {
    requestBody.custom_headers = [`Reply-To: ${replyTo}`];
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Smtp2go-Api-Key": normalizeText(env.smtp2goApiKey)
      },
      body: JSON.stringify(requestBody)
    });
  } catch {
    return { ok: false, skipped: true, reason: "smtp2go-request-failed" };
  }

  const contentType = normalizeText(response.headers.get("content-type")).toLowerCase();
  const parsed = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;
  if (!response.ok) {
    return {
      ok: false,
      skipped: true,
      reason: "smtp2go-api-error",
      error: resolveApiErrorMessage(parsed, `SMTP2GO API request failed (${response.status})`)
    };
  }

  const succeededEntries = Array.isArray(parsed?.data?.succeeded) ? parsed.data.succeeded : [];
  const failedEntries = Array.isArray(parsed?.data?.failed) ? parsed.data.failed : [];
  const succeededRecipients = succeededEntries
    .map((entry) => normalizeEmail(entry?.email || entry))
    .filter(Boolean);
  if (failedEntries.length && !succeededRecipients.length) {
    return { ok: false, skipped: true, reason: "smtp2go-delivery-failed", failed: failedEntries };
  }

  return {
    ok: true,
    sentTo: succeededRecipients.length ? succeededRecipients : recipients,
    requestId: normalizeText(parsed?.data?.request_id || parsed?.request_id)
  };
}

module.exports = {
  isMailerConfigured,
  sendEmail
};
