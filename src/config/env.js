const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadFromLegacyEnvTxt() {
  const envTxtPath = path.resolve(process.cwd(), "env.txt");
  if (!fs.existsSync(envTxtPath)) return null;
  try {
    const raw = fs.readFileSync(envTxtPath, "utf8");
    const line = raw
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.toLowerCase().startsWith("database_url="));
    if (!line) return null;
    return line.slice("database_url=".length).trim();
  } catch {
    return null;
  }
}

function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function extractDomainFromEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0 || atIndex >= email.length - 1) return "";
  return normalizeDomain(email.slice(atIndex + 1));
}

function toIntegerInRange(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
function parseCorsOrigins(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (raw === "*") return ["*"];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidCorsOrigin(origin) {
  const normalized = String(origin || "").trim().replace(/\/+$/, "");
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    if (![ "http:", "https:" ].includes(parsed.protocol)) return false;
    return parsed.origin.toLowerCase() === normalized.toLowerCase();
  } catch {
    return false;
  }
}

function loadEnvironment() {
  dotenv.config();

  const nodeEnv = process.env.NODE_ENV || "development";
  const mongoFromTxt = loadFromLegacyEnvTxt();
  const mongoUri = process.env.MONGODB_URI || mongoFromTxt || "";
  const port = Number(process.env.PORT || 3000);
  const corsOriginRaw = process.env.CORS_ORIGIN || (nodeEnv === "production" ? "" : "*");
  const parsedCorsOrigins = parseCorsOrigins(corsOriginRaw);
  if (nodeEnv === "production") {
    if (!parsedCorsOrigins.length) {
      throw new Error("Missing CORS_ORIGIN in production. Set a comma-separated allowlist of HTTPS origins.");
    }
    if (parsedCorsOrigins.includes("*")) {
      throw new Error("CORS_ORIGIN cannot be '*' in production. Set explicit allowed origin(s).");
    }
  }
  const invalidCorsOrigin = parsedCorsOrigins.find((origin) => origin !== "*" && !isValidCorsOrigin(origin));
  if (invalidCorsOrigin) {
    throw new Error(`Invalid CORS_ORIGIN value: ${invalidCorsOrigin}. Use full origin format, e.g. https://app.booqdat.com`);
  }
  const corsOrigin = parsedCorsOrigins.length > 1
    ? parsedCorsOrigins
    : parsedCorsOrigins[0] || "*";
  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "12mb";
  const jwtSecret = process.env.JWT_SECRET || (nodeEnv === "production" ? "" : "dev-local-jwt-secret-change-me");
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || (nodeEnv === "production" ? "" : "dev-local-refresh-secret-change-me");
  const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || "";
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || "";
  const smtp2goApiBaseUrl = process.env.SMTP2GO_API_BASE_URL || "https://api.smtp2go.com/v3";
  const smtp2goApiKey = process.env.SMTP2GO_API_KEY || "";
  const configuredMailFrom = String(process.env.MAIL_FROM || "").trim();
  const configuredSenderDomain = normalizeDomain(process.env.SENDER_DOMAIN || "");
  const senderDomain = configuredSenderDomain || extractDomainFromEmail(configuredMailFrom) || "booqdat.com";
  const mailFrom = configuredMailFrom || (senderDomain ? `no-reply@${senderDomain}` : "no-reply@booqdat.com");
  const mailFromName = process.env.MAIL_FROM_NAME || "BOOQDAT";
  const mailReplyTo = process.env.MAIL_REPLY_TO || process.env.SUPPORT_EMAIL || "";
  const supportEmail = process.env.SUPPORT_EMAIL || "helloworld@booqdat.com";
  const companyName = process.env.COMPANY_NAME || "BOOQDAT";
  const nyvapayBaseUrl = process.env.NYVAPAY_BASE_URL || "https://nyvapay.com";
  const nyvapayMerchantEmail = process.env.NYVAPAY_MERCHANT_EMAIL || "";
  const nyvapayApiKey = process.env.NYVAPAY_API_KEY || "";
  const nyvapayWebhookUrl = process.env.NYVAPAY_WEBHOOK_URL || "";
  const nyvapaySuccessRedirectUrl = process.env.NYVAPAY_SUCCESS_REDIRECT_URL || "";
  const nyvapayWebhookToken = process.env.NYVAPAY_WEBHOOK_TOKEN || "";
  const nyvapayTimeoutMs = toIntegerInRange(process.env.NYVAPAY_TIMEOUT_MS, 8000, 2000, 20000);
  const nyvapayMaxAttempts = toIntegerInRange(process.env.NYVAPAY_MAX_ATTEMPTS, 2, 1, 2);

  if (!mongoUri) {
    throw new Error("Missing MongoDB URI. Set MONGODB_URI in environment.");
  }
  if (!jwtSecret) {
    throw new Error("Missing JWT secret. Set JWT_SECRET in environment.");
  }
  if (!refreshTokenSecret) {
    throw new Error("Missing refresh token secret. Set REFRESH_TOKEN_SECRET in environment.");
  }

  return {
    mongoUri,
    port: Number.isFinite(port) ? port : 3000,
    nodeEnv,
    corsOrigin,
    requestBodyLimit,
    jwtSecret,
    jwtExpiresIn,
    refreshTokenSecret,
    refreshTokenExpiresIn,
    seedAdminEmail,
    seedAdminPassword,
    smtp2goApiBaseUrl,
    smtp2goApiKey,
    senderDomain,
    mailFrom,
    mailFromName,
    mailReplyTo,
    supportEmail,
    companyName,
    nyvapayBaseUrl,
    nyvapayMerchantEmail,
    nyvapayApiKey,
    nyvapayWebhookUrl,
    nyvapaySuccessRedirectUrl,
    nyvapayWebhookToken,
    nyvapayTimeoutMs,
    nyvapayMaxAttempts
  };
}

module.exports = { loadEnvironment };
