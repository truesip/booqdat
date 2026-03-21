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

function loadEnvironment() {
  dotenv.config();

  const nodeEnv = process.env.NODE_ENV || "development";
  const mongoFromTxt = loadFromLegacyEnvTxt();
  const mongoUri = process.env.MONGODB_URI || mongoFromTxt || "";
  const port = Number(process.env.PORT || 3000);
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  const jwtSecret = process.env.JWT_SECRET || (nodeEnv === "production" ? "" : "dev-local-jwt-secret-change-me");
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || (nodeEnv === "production" ? "" : "dev-local-refresh-secret-change-me");
  const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || "";
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || "";
  const smtp2goApiBaseUrl = process.env.SMTP2GO_API_BASE_URL || "https://api.smtp2go.com/v3";
  const smtp2goApiKey = process.env.SMTP2GO_API_KEY || "";
  const mailFrom = process.env.MAIL_FROM || "no-reply@booqdat.com";
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
    jwtSecret,
    jwtExpiresIn,
    refreshTokenSecret,
    refreshTokenExpiresIn,
    seedAdminEmail,
    seedAdminPassword,
    smtp2goApiBaseUrl,
    smtp2goApiKey,
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
    nyvapayWebhookToken
  };
}

module.exports = { loadEnvironment };
