const nodemailer = require("nodemailer");

let transporterCache = null;
let cacheKey = "";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeEmail(item)).filter(Boolean);
  }
  const single = normalizeEmail(value);
  return single ? [single] : [];
}

function isMailerConfigured(env) {
  return Boolean(
    String(env.smtp2goHost || "").trim() &&
    Number(env.smtp2goPort) > 0 &&
    String(env.smtp2goUsername || "").trim() &&
    String(env.smtp2goPassword || "").trim() &&
    String(env.mailFrom || "").trim()
  );
}

function getTransporter(env) {
  if (!isMailerConfigured(env)) return null;
  const nextCacheKey = [
    env.smtp2goHost,
    env.smtp2goPort,
    env.smtp2goUsername,
    env.smtp2goPassword
  ].join("|");
  if (transporterCache && cacheKey === nextCacheKey) return transporterCache;

  transporterCache = nodemailer.createTransport({
    host: env.smtp2goHost,
    port: Number(env.smtp2goPort),
    secure: Number(env.smtp2goPort) === 465,
    auth: {
      user: env.smtp2goUsername,
      pass: env.smtp2goPassword
    }
  });
  cacheKey = nextCacheKey;
  return transporterCache;
}

async function sendEmail(env, payload) {
  const recipients = resolveRecipients(payload?.to);
  if (!recipients.length) {
    return { ok: false, skipped: true, reason: "missing-recipient" };
  }

  const transporter = getTransporter(env);
  if (!transporter) {
    return { ok: false, skipped: true, reason: "smtp2go-not-configured" };
  }

  const fromName = String(env.mailFromName || "").trim();
  const fromAddress = String(env.mailFrom || "").trim();
  const from = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
  const replyTo = String(payload?.replyTo || env.mailReplyTo || "").trim();

  await transporter.sendMail({
    from,
    to: recipients.join(", "),
    replyTo: replyTo || undefined,
    subject: String(payload?.subject || "BOOQDAT Notification"),
    text: String(payload?.text || ""),
    html: String(payload?.html || "")
  });

  return { ok: true, sentTo: recipients };
}

module.exports = {
  isMailerConfigured,
  sendEmail
};
