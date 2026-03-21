const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppEvent = require("../models/AppEvent");
const PromoterEvent = require("../models/PromoterEvent");
const OrderRecord = require("../models/OrderRecord");
const UserProfile = require("../models/UserProfile");
const UserPaymentMethods = require("../models/UserPaymentMethods");
const UserFavorites = require("../models/UserFavorites");
const PromoterPayoutAccount = require("../models/PromoterPayoutAccount");
const UserAccount = require("../models/UserAccount");
const RefreshToken = require("../models/RefreshToken");
const AccessTokenBlocklist = require("../models/AccessTokenBlocklist");
const { sendEmail } = require("../services/mailer");
const {
  welcomeEmailTemplate,
  ticketConfirmationTemplate,
  promoterSaleAlertTemplate,
  promoterEventPublishedTemplate
} = require("../services/emailTemplates");
const { createNyvapayPaymentLink, isNyvapayConfigured } = require("../services/nyvapay");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (["admin", "promoter", "user"].includes(role)) return role;
  return "";
}

const LEGACY_DEMO_EVENT_IDS = new Set(["evt-1001", "evt-1002", "evt-1003", "evt-1004", "evt-1005", "evt-1006"]);
const LEGACY_DEMO_EVENT_TITLES = new Set([
  "sunset rooftop sessions",
  "southwest comedy night",
  "high desert boxing showcase",
  "creative founder meetup",
  "city food & culture fest",
  "desert bass weekender",
  "skyline bass social",
  "founder mixer: creative southwest",
  "downtown comedy trial run"
]);

function normalizeEventTitle(value) {
  return String(value || "").trim().toLowerCase();
}

function isLegacyDemoEventData(event) {
  if (!event || typeof event !== "object") return false;
  const id = String(event.id || "").trim();
  const title = normalizeEventTitle(event.title);
  if (LEGACY_DEMO_EVENT_IDS.has(id)) return true;
  return LEGACY_DEMO_EVENT_TITLES.has(title);
}

function filterLegacyDemoEvents(events) {
  return ensureArray(events).filter((event) => !isLegacyDemoEventData(event));
}

function isLegacyDemoOrderData(order) {
  if (!order || typeof order !== "object") return false;
  const eventId = String(order.eventId || "").trim();
  const eventTitle = normalizeEventTitle(order.eventTitle);
  if (LEGACY_DEMO_EVENT_IDS.has(eventId)) return true;
  return LEGACY_DEMO_EVENT_TITLES.has(eventTitle);
}

function filterLegacyDemoOrders(orders) {
  return ensureArray(orders).filter((order) => !isLegacyDemoOrderData(order));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function parseBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function expiryDateFromDecodedToken(decoded) {
  const exp = Number(decoded?.exp);
  if (!Number.isFinite(exp)) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return new Date(exp * 1000);
}

function requestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.ip || "");
}

async function upsertRows(Model, rows, idField, dataMapper) {
  const operations = rows.map((item) => {
    const idValue = item[idField];
    return {
      updateOne: {
        filter: { [idField]: idValue },
        update: { [idField]: idValue, ...dataMapper(item) },
        upsert: true
      }
    };
  });
  if (!operations.length) return 0;
  await Model.bulkWrite(operations);
  return operations.length;
}

function toProfileMap(rows) {
  return rows.reduce((acc, item) => {
    acc[item.email] = item.data;
    return acc;
  }, {});
}

function toMethodsMap(rows) {
  return rows.reduce((acc, item) => {
    acc[item.email] = ensureArray(item.methods);
    return acc;
  }, {});
}

function toFavoritesMap(rows) {
  return rows.reduce((acc, item) => {
    acc[item.email] = ensureArray(item.eventIds);
    return acc;
  }, {});
}

function normalizeLifecycleStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isLiveEventStatus(value) {
  const status = normalizeLifecycleStatus(value);
  return status === "live" || status === "approved" || status === "active";
}

function isPendingReviewEventStatus(value) {
  const status = normalizeLifecycleStatus(value);
  return status.includes("pending")
    || status.includes("review")
    || status.includes("submitted")
    || status.includes("flag");
}

function isSettledOrderData(order) {
  const status = normalizeLifecycleStatus(order?.status);
  const paymentStatus = normalizeLifecycleStatus(order?.paymentStatus);
  if (status.includes("refund") || paymentStatus.includes("refund")) return false;
  if (["paid", "completed", "confirmed", "succeeded", "successful", "settled", "captured"].includes(paymentStatus)) {
    return true;
  }
  if (["paid", "completed", "confirmed"].includes(status)) {
    return true;
  }
  return false;
}

function createApiRouter(env) {
  const router = express.Router();
  const jwtIssuer = "booqdat-platform";
  const companyName = String(env.companyName || "BOOQDAT");
  const supportEmail = String(env.supportEmail || env.mailReplyTo || env.mailFrom || "");

  router.use((req, res, next) => {
    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store"
    });
    res.vary("Authorization");
    next();
  });

  async function sendTemplateEmail(recipient, template, contextLabel) {
    if (!isValidEmail(recipient)) {
      return { ok: false, skipped: true, reason: "invalid-recipient" };
    }
    try {
      return await sendEmail(env, {
        to: recipient,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } catch (error) {
      console.error(`Email send failed (${contextLabel}):`, error.message);
      return { ok: false, skipped: true, reason: "send-failed" };
    }
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function truncateText(value, maxLength) {
    const text = normalizeText(value);
    if (!maxLength || text.length <= maxLength) return text;
    return text.slice(0, maxLength);
  }

  function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toPositiveAmount(value) {
    const parsed = toFiniteNumber(value, 0);
    return parsed > 0 ? parsed : 0;
  }

  function normalizeCurrency(value) {
    const currency = normalizeText(value || "USD").toUpperCase();
    return currency || "USD";
  }

  function isValidHttpUrl(value) {
    const text = normalizeText(value);
    if (!text) return false;
    try {
      const parsed = new URL(text);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function appBaseUrlFromRequest(req) {
    const forwardedProto = normalizeText(String(req.headers["x-forwarded-proto"] || "").split(",")[0]);
    const forwardedHost = normalizeText(String(req.headers["x-forwarded-host"] || "").split(",")[0]);
    const protocol = forwardedProto || normalizeText(req.protocol) || "https";
    const host = forwardedHost || normalizeText(req.get("host"));
    if (!host) return "";
    return `${protocol}://${host}`;
  }

  function withOptionalWebhookToken(url) {
    if (!isValidHttpUrl(url)) return "";
    const token = normalizeText(env.nyvapayWebhookToken);
    if (!token) return url;
    const parsed = new URL(url);
    if (!parsed.searchParams.get("token")) {
      parsed.searchParams.set("token", token);
    }
    return parsed.toString();
  }

  function resolveNyvapayWebhookUrl(req) {
    const configured = normalizeText(env.nyvapayWebhookUrl);
    if (isValidHttpUrl(configured)) {
      return withOptionalWebhookToken(configured);
    }
    const appBase = appBaseUrlFromRequest(req);
    if (!appBase) return "";
    return withOptionalWebhookToken(`${appBase}/api/payments/nyvapay/webhook`);
  }

  function resolveNyvapaySuccessRedirectUrl(req, order) {
    const configured = normalizeText(env.nyvapaySuccessRedirectUrl);
    if (isValidHttpUrl(configured)) return configured;
    const appBase = appBaseUrlFromRequest(req);
    if (!appBase) return "";
    const params = new URLSearchParams();
    const eventId = truncateText(order?.eventId, 120);
    const orderId = truncateText(order?.id, 120);
    const attendeeEmail = normalizeEmail(order?.attendee?.email);
    if (eventId) params.set("event", eventId);
    if (orderId) params.set("order", orderId);
    if (attendeeEmail) params.set("email", attendeeEmail);
    params.set("nyvapay", "success");
    return `${appBase}/checkout.html?${params.toString()}`;
  }

  function generateTicketToken() {
    return `BQD-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;
  }

  function extractWebhookPayload(body) {
    if (body?.data && typeof body.data === "object") return body.data;
    if (body?.payload && typeof body.payload === "object") return body.payload;
    if (body && typeof body === "object") return body;
    return {};
  }

  function extractWebhookEventName(body) {
    return normalizeText(body?.event || body?.type || body?.name);
  }

  function extractWebhookOrderReference(payload, body) {
    const candidates = [
      payload?.order,
      payload?.order_id,
      payload?.orderId,
      payload?.reference,
      payload?.reference_id,
      payload?.metadata?.orderId,
      payload?.metadata?.order_id,
      body?.order,
      body?.order_id,
      body?.orderId,
      body?.metadata?.orderId,
      body?.metadata?.order_id
    ];
    for (const candidate of candidates) {
      const value = truncateText(candidate, 120);
      if (value) return value;
    }
    return "";
  }

  function orderBelongsToPromoter(order, promoterEmail, ownedEventIds = new Set()) {
    const orderPromoterEmail = normalizeEmail(order?.promoterEmail);
    const orderEventId = truncateText(order?.eventId, 120);
    if (orderPromoterEmail && orderPromoterEmail === promoterEmail) return true;
    if (orderEventId && ownedEventIds.has(orderEventId)) return true;
    return false;
  }

  function toDateOrNull(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function addDays(inputDate, days) {
    const base = toDateOrNull(inputDate) || new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next.toISOString();
  }

  async function getPromoterOwnedEventIds(promoterEmail) {
    if (!promoterEmail) return new Set();
    const rows = await PromoterEvent.find({}).lean();
    const ids = new Set();
    rows.forEach((row) => {
      const event = row?.data && typeof row.data === "object" ? row.data : {};
      if (normalizeEmail(event?.promoterEmail) === promoterEmail) {
        const id = truncateText(event?.id || row?.eventId, 120);
        if (id) ids.add(id);
      }
    });
    return ids;
  }

  function extractWebhookTransactionId(payload, body) {
    const candidates = [
      payload?.transaction_id,
      payload?.transactionId,
      payload?.payment_id,
      payload?.paymentId,
      payload?.id,
      body?.transaction_id,
      body?.transactionId,
      body?.payment_id,
      body?.paymentId,
      body?.id
    ];
    for (const candidate of candidates) {
      const value = truncateText(candidate, 120);
      if (value) return value;
    }
    return "";
  }

  function signAccessToken(account) {
    return jwt.sign(
      {
        sub: String(account._id),
        email: account.email,
        role: account.role,
        name: account.name,
        type: "access"
      },
      env.jwtSecret,
      {
        expiresIn: env.jwtExpiresIn,
        issuer: jwtIssuer,
        jwtid: crypto.randomUUID()
      }
    );
  }

  function signRefreshToken(account) {
    return jwt.sign(
      {
        sub: String(account._id),
        email: account.email,
        role: account.role,
        type: "refresh"
      },
      env.refreshTokenSecret,
      {
        expiresIn: env.refreshTokenExpiresIn,
        issuer: jwtIssuer,
        jwtid: crypto.randomUUID()
      }
    );
  }

  function verifyAccessToken(token, options = {}) {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, env.jwtSecret, {
        issuer: jwtIssuer,
        ignoreExpiration: Boolean(options.ignoreExpiration)
      });
      if (decoded?.type !== "access") return null;
      return decoded;
    } catch {
      return null;
    }
  }

  function verifyRefreshToken(token, options = {}) {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, env.refreshTokenSecret, {
        issuer: jwtIssuer,
        ignoreExpiration: Boolean(options.ignoreExpiration)
      });
      if (decoded?.type !== "refresh") return null;
      return decoded;
    } catch {
      return null;
    }
  }

  function authPayloadToUser(decoded) {
    return {
      id: String(decoded.sub),
      email: decoded.email,
      role: decoded.role,
      name: decoded.name || ""
    };
  }

  function authSuccessPayload(account, tokenBundle) {
    return {
      ok: true,
      token: tokenBundle.accessToken,
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      user: {
        id: String(account._id),
        name: account.name,
        email: account.email,
        role: account.role
      }
    };
  }

  async function isAccessTokenBlacklisted(tokenId) {
    if (!tokenId) return false;
    const row = await AccessTokenBlocklist.findOne({ tokenId }).lean();
    return Boolean(row);
  }

  async function revokeAllRefreshTokensForUser(userId, reason) {
    const now = new Date();
    await RefreshToken.updateMany(
      { userId, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, revokedReason: reason } }
    );
  }

  async function blacklistAccessToken(authPayload, reason = "logout") {
    const tokenId = String(authPayload?.jti || "");
    if (!tokenId) return;
    const expiresAt = expiryDateFromDecodedToken(authPayload);
    if (expiresAt <= new Date()) return;
    await AccessTokenBlocklist.updateOne(
      { tokenId },
      {
        $setOnInsert: {
          tokenId,
          userId: String(authPayload.sub),
          expiresAt,
          reason
        }
      },
      { upsert: true }
    );
  }

  async function persistRefreshTokenRecord(account, refreshToken, req) {
    const decoded = jwt.decode(refreshToken);
    const tokenId = String(decoded?.jti || "");
    if (!tokenId) throw new Error("Failed to issue refresh token");
    await RefreshToken.create({
      tokenId,
      userId: String(account._id),
      tokenHash: hashToken(refreshToken),
      expiresAt: expiryDateFromDecodedToken(decoded),
      revokedAt: null,
      revokedReason: "",
      createdByIp: requestIp(req)
    });
    return tokenId;
  }

  async function issueTokenBundle(account, req) {
    const accessToken = signAccessToken(account);
    const refreshToken = signRefreshToken(account);
    const refreshTokenId = await persistRefreshTokenRecord(account, refreshToken, req);
    return {
      accessToken,
      refreshToken,
      refreshTokenId
    };
  }

  async function authenticateRequest(req, options = {}) {
    const token = parseBearerToken(req);
    if (!token) return null;

    const decoded = verifyAccessToken(token, { ignoreExpiration: Boolean(options.ignoreExpiration) });
    if (!decoded) return null;

    if (await isAccessTokenBlacklisted(decoded.jti)) return null;

    const account = await UserAccount.findById(decoded.sub).select("_id isActive").lean();
    if (!account || !account.isActive) return null;

    req.authToken = token;
    return decoded;
  }

  async function attachOptionalAuth(req, _res, next) {
    try {
      req.auth = await authenticateRequest(req);
      next();
    } catch (error) {
      next(error);
    }
  }

  async function requireAuth(req, res, next) {
    try {
      const decoded = await authenticateRequest(req);
      if (!decoded) {
        res.status(401).json({ ok: false, error: "Authentication required" });
        return;
      }
      req.auth = decoded;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireRoles(...roles) {
    const allowed = roles.map((role) => normalizeRole(role)).filter(Boolean);
    return (req, res, next) => {
      const role = normalizeRole(req.auth?.role);
      if (!allowed.includes(role)) {
        res.status(403).json({ ok: false, error: "Insufficient permissions" });
        return;
      }
      next();
    };
  }

  router.get("/health", async (_req, res) => {
    res.status(200).json({ ok: true });
  });

  router.post("/auth/register", async (req, res, next) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const role = normalizeRole(req.body?.role || "user");

      if (!email || !password || !role) {
        res.status(400).json({ ok: false, error: "email, password, and role are required" });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
        return;
      }
      if (role === "admin") {
        res.status(403).json({ ok: false, error: "Admin accounts can only be created by platform owners" });
        return;
      }

      const existing = await UserAccount.findOne({ email }).lean();
      if (existing) {
        res.status(409).json({ ok: false, error: "Account already exists for this email" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const account = await UserAccount.create({
        name: name || email.split("@")[0],
        email,
        role,
        passwordHash,
        isActive: true,
        lastLoginAt: new Date()
      });

      const tokenBundle = await issueTokenBundle(account, req);
      const welcomeTemplate = welcomeEmailTemplate({
        companyName,
        name: account.name,
        role: account.role,
        dashboardUrl: account.role === "admin"
          ? "/admin.html"
          : account.role === "promoter"
            ? "/promoter-dashboard.html"
            : "/user-portal.html"
      });
      await sendTemplateEmail(account.email, welcomeTemplate, `welcome-${account.role}`);
      res.status(201).json(authSuccessPayload(account, tokenBundle));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      if (!email || !password) {
        res.status(400).json({ ok: false, error: "email and password are required" });
        return;
      }

      const account = await UserAccount.findOne({ email });
      if (!account || !account.isActive) {
        res.status(401).json({ ok: false, error: "Invalid credentials", errorCode: "INVALID_CREDENTIALS" });
        return;
      }

      const matches = await bcrypt.compare(password, account.passwordHash);
      if (!matches) {
        res.status(401).json({ ok: false, error: "Invalid credentials", errorCode: "INVALID_CREDENTIALS" });
        return;
      }

      account.lastLoginAt = new Date();
      await account.save();

      const tokenBundle = await issueTokenBundle(account, req);
      res.status(200).json(authSuccessPayload(account, tokenBundle));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/refresh", async (req, res, next) => {
    try {
      const incomingRefreshToken = String(req.body?.refreshToken || "").trim();
      if (!incomingRefreshToken) {
        res.status(400).json({ ok: false, error: "refreshToken is required" });
        return;
      }

      const decoded = verifyRefreshToken(incomingRefreshToken);
      if (!decoded) {
        res.status(401).json({ ok: false, error: "Invalid refresh token" });
        return;
      }

      const account = await UserAccount.findById(decoded.sub);
      if (!account || !account.isActive) {
        res.status(401).json({ ok: false, error: "Invalid session" });
        return;
      }

      const currentTokenId = String(decoded.jti || "");
      if (!currentTokenId) {
        res.status(401).json({ ok: false, error: "Invalid refresh token" });
        return;
      }

      const stored = await RefreshToken.findOne({ tokenId: currentTokenId, userId: String(account._id) });
      if (!stored) {
        res.status(401).json({ ok: false, error: "Refresh token not found" });
        return;
      }

      if (stored.revokedAt) {
        await revokeAllRefreshTokensForUser(String(account._id), "refresh-token-reuse-detected");
        res.status(401).json({ ok: false, error: "Refresh token has been revoked" });
        return;
      }

      if (stored.expiresAt <= new Date()) {
        res.status(401).json({ ok: false, error: "Refresh token has expired" });
        return;
      }

      if (stored.tokenHash !== hashToken(incomingRefreshToken)) {
        await revokeAllRefreshTokensForUser(String(account._id), "refresh-token-hash-mismatch");
        res.status(401).json({ ok: false, error: "Invalid refresh token" });
        return;
      }

      const tokenBundle = await issueTokenBundle(account, req);
      stored.revokedAt = new Date();
      stored.replacedByTokenId = tokenBundle.refreshTokenId;
      stored.revokedReason = "rotated";
      await stored.save();

      res.status(200).json(authSuccessPayload(account, tokenBundle));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/logout", requireAuth, async (req, res, next) => {
    try {
      await blacklistAccessToken(req.auth, "logout");

      const incomingRefreshToken = String(req.body?.refreshToken || "").trim();
      if (incomingRefreshToken) {
        const decodedRefresh = verifyRefreshToken(incomingRefreshToken, { ignoreExpiration: true });
        if (decodedRefresh && String(decodedRefresh.sub) === String(req.auth.sub)) {
          const refreshTokenId = String(decodedRefresh.jti || "");
          if (refreshTokenId) {
            await RefreshToken.updateOne(
              { tokenId: refreshTokenId, userId: String(req.auth.sub), revokedAt: null },
              { $set: { revokedAt: new Date(), revokedReason: "logout" } }
            );
          }
        }
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/logout-all", requireAuth, async (req, res, next) => {
    try {
      await blacklistAccessToken(req.auth, "logout-all");
      await revokeAllRefreshTokensForUser(String(req.auth.sub), "logout-all");
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/auth/me", requireAuth, async (req, res, next) => {
    try {
      const account = await UserAccount.findById(req.auth.sub).lean();
      if (!account || !account.isActive) {
        res.status(401).json({ ok: false, error: "Invalid session" });
        return;
      }
      res.status(200).json({
        ok: true,
        user: {
          id: String(account._id),
          name: account.name,
          email: account.email,
          role: account.role
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/notifications/ticket-confirmation", async (req, res, next) => {
    try {
      const order = req.body?.order || {};
      const attendeeEmail = normalizeEmail(order?.attendee?.email);
      const promoterEmail = normalizeEmail(req.body?.promoterEmail);

      if (!isValidEmail(attendeeEmail)) {
        res.status(400).json({ ok: false, error: "Valid attendee email is required" });
        return;
      }

      const portalUrl = `/user-portal.html?email=${encodeURIComponent(attendeeEmail)}`;
      const userTemplate = ticketConfirmationTemplate({
        companyName,
        order,
        portalUrl,
        supportEmail
      });

      const userDelivery = await sendTemplateEmail(attendeeEmail, userTemplate, "ticket-confirmation-user");

      let promoterDelivery = { ok: false, skipped: true, reason: "not-requested" };
      if (isValidEmail(promoterEmail) && promoterEmail !== attendeeEmail) {
        const promoterTemplate = promoterSaleAlertTemplate({ companyName, order });
        promoterDelivery = await sendTemplateEmail(promoterEmail, promoterTemplate, "ticket-sale-promoter");
      }

      res.status(200).json({
        ok: true,
        attendeeEmail,
        promoterEmail: promoterEmail || null,
        attendeeEmailSent: Boolean(userDelivery.ok),
        promoterEmailSent: Boolean(promoterDelivery.ok)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/notifications/promoter-event-published", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const event = req.body?.event || {};
      const shareLink = String(req.body?.shareLink || "").trim();
      const promoterEmail = normalizeEmail(req.body?.promoterEmail || req.auth?.email);

      if (!isValidEmail(promoterEmail)) {
        res.status(400).json({ ok: false, error: "Valid promoter email is required" });
        return;
      }

      const template = promoterEventPublishedTemplate({
        companyName,
        event,
        shareLink
      });
      const delivery = await sendTemplateEmail(promoterEmail, template, "promoter-event-published");

      res.status(200).json({
        ok: true,
        promoterEmail,
        emailSent: Boolean(delivery.ok)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/nyvapay/payment-link", async (req, res, next) => {
    try {
      if (!isNyvapayConfigured(env)) {
        res.status(503).json({ ok: false, error: "NYVAPAY is not configured on this server" });
        return;
      }

      const incomingOrder = req.body?.order && typeof req.body.order === "object" ? req.body.order : {};
      const orderId = truncateText(incomingOrder?.id || req.body?.orderId, 120) || `ord-${Date.now()}`;
      const eventId = truncateText(incomingOrder?.eventId || req.body?.eventId, 120);
      const eventTitle = truncateText(incomingOrder?.eventTitle || req.body?.eventTitle, 200);
      const attendeeEmail = normalizeEmail(incomingOrder?.attendee?.email || req.body?.customer_email);
      const attendeeName = truncateText(incomingOrder?.attendee?.name || req.body?.customer_name, 200) || "Attendee";
      const attendeePhone = truncateText(incomingOrder?.attendee?.phone || req.body?.customer_phone, 60);
      const promoterEmail = normalizeEmail(incomingOrder?.promoterEmail || req.body?.promoterEmail);
      const quantity = Math.max(1, Math.floor(toFiniteNumber(incomingOrder?.quantity, 1)));
      const subtotal = toPositiveAmount(incomingOrder?.subtotal);
      const fee = toPositiveAmount(incomingOrder?.fee);
      const orderTotal = toPositiveAmount(incomingOrder?.total);
      const amount = toPositiveAmount(req.body?.amount || orderTotal || subtotal + fee);
      const currency = normalizeCurrency(req.body?.currency || incomingOrder?.currency || "USD");

      if (!eventTitle) {
        res.status(400).json({ ok: false, error: "eventTitle is required" });
        return;
      }
      if (!isValidEmail(attendeeEmail)) {
        res.status(400).json({ ok: false, error: "Valid attendee email is required" });
        return;
      }
      if (!amount) {
        res.status(400).json({ ok: false, error: "amount must be a positive number" });
        return;
      }

      const pendingOrder = {
        ...incomingOrder,
        id: orderId,
        eventId,
        promoterEmail,
        eventTitle,
        eventDate: truncateText(incomingOrder?.eventDate || req.body?.eventDate, 40),
        eventTime: truncateText(incomingOrder?.eventTime || req.body?.eventTime, 20),
        venue: truncateText(incomingOrder?.venue || req.body?.venue, 200),
        city: truncateText(incomingOrder?.city || req.body?.city, 120),
        state: truncateText(incomingOrder?.state || req.body?.state, 120),
        country: truncateText(incomingOrder?.country || req.body?.country, 120),
        attendee: {
          name: attendeeName,
          email: attendeeEmail,
          phone: attendeePhone
        },
        ticketType: truncateText(incomingOrder?.ticketType, 120) || "General Admission",
        quantity,
        subtotal: subtotal || Math.max(0, amount - fee),
        fee,
        total: amount,
        currency,
        status: "Pending Payment",
        paymentStatus: "Link Created",
        paymentProvider: "NYVAPAY",
        purchaseDate: truncateText(incomingOrder?.purchaseDate, 60) || new Date().toISOString(),
        ticketToken: truncateText(incomingOrder?.ticketToken, 120) || generateTicketToken()
      };

      const webhookUrl = resolveNyvapayWebhookUrl(req);
      if (!webhookUrl) {
        res.status(500).json({ ok: false, error: "Unable to resolve NYVAPAY webhook URL" });
        return;
      }

      const providedSuccessRedirect = normalizeText(req.body?.successRedirectUrl || req.body?.success_redirect_url);
      const successRedirectUrl = isValidHttpUrl(providedSuccessRedirect)
        ? providedSuccessRedirect
        : resolveNyvapaySuccessRedirectUrl(req, pendingOrder);

      const incomingMetadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
      const expiryHoursRaw = toFiniteNumber(req.body?.expiry_hours ?? req.body?.expiryHours, 24);
      const expiryHours = Math.max(1, Math.min(168, Math.round(expiryHoursRaw || 24)));
      const productName = truncateText(req.body?.product_name, 200) || truncateText(`${eventTitle} x${quantity}`, 200);
      const note = truncateText(req.body?.note, 500) || truncateText(`BOOQDAT ticket purchase for ${eventTitle}`, 500);

      const gatewayPayload = {
        amount,
        currency,
        product_name: productName,
        order: truncateText(orderId, 100),
        note,
        customer_email: attendeeEmail,
        customer_name: attendeeName,
        webhook_url: webhookUrl,
        reusable: false,
        expiry_hours: expiryHours,
        metadata: {
          ...incomingMetadata,
          orderId,
          eventId,
          quantity,
          attendeeEmail,
          ticketToken: pendingOrder.ticketToken,
          promoterEmail,
          source: "booqdat_checkout"
        }
      };
      if (successRedirectUrl) {
        gatewayPayload.success_redirect_url = successRedirectUrl;
      }

      const gatewayResult = await createNyvapayPaymentLink(env, gatewayPayload);
      if (!gatewayResult.ok) {
        console.error("NYVAPAY payment link creation failed", {
          orderId,
          eventId,
          status: gatewayResult.status || 502,
          error: gatewayResult.error || "",
          gatewayResponseInfo: gatewayResult.payloadInfo || null,
          gatewayPayloadSummary: {
            amount: gatewayPayload.amount,
            currency: gatewayPayload.currency,
            hasWebhookUrl: Boolean(gatewayPayload.webhook_url),
            hasSuccessRedirectUrl: Boolean(gatewayPayload.success_redirect_url),
            customerEmail: gatewayPayload.customer_email
          }
        });
        const statusCode = Number.isInteger(gatewayResult.status) ? gatewayResult.status : 502;
        res.status(statusCode).json({
          ok: false,
          error: gatewayResult.error || "Failed to create NYVAPAY payment link",
          errorCode: "NYVAPAY_GATEWAY_ERROR",
          gatewayStatus: statusCode
        });
        return;
      }

      pendingOrder.nyvapay = {
        status: "link_created",
        paymentUrl: gatewayResult.paymentUrl,
        linkId: gatewayResult.linkId || "",
        createdAt: new Date().toISOString()
      };

      await OrderRecord.updateOne(
        { orderId },
        {
          $set: {
            orderId,
            attendeeEmail,
            data: pendingOrder
          }
        },
        { upsert: true }
      );

      res.status(200).json({
        ok: true,
        provider: "NYVAPAY",
        order: pendingOrder,
        paymentUrl: gatewayResult.paymentUrl,
        linkId: gatewayResult.linkId || null
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/nyvapay/webhook", async (req, res, next) => {
    try {
      const expectedWebhookToken = normalizeText(env.nyvapayWebhookToken);
      if (expectedWebhookToken) {
        const incomingToken = normalizeText(req.query?.token);
        if (incomingToken !== expectedWebhookToken) {
          res.status(401).json({ ok: false, error: "Invalid webhook token" });
          return;
        }
      }

      const rawEventName = extractWebhookEventName(req.body);
      const eventName = rawEventName.toLowerCase();
      if (eventName !== "payment.succeeded") {
        res.status(200).json({ ok: true, ignored: true, event: rawEventName || null });
        return;
      }

      const payload = extractWebhookPayload(req.body);
      const orderReference = extractWebhookOrderReference(payload, req.body);
      if (!orderReference) {
        res.status(400).json({ ok: false, error: "Missing order reference in webhook payload" });
        return;
      }

      const orderRow = await OrderRecord.findOne({ orderId: orderReference });
      if (!orderRow) {
        res.status(404).json({ ok: false, error: "Order not found" });
        return;
      }

      const existingOrder = orderRow.data && typeof orderRow.data === "object" ? orderRow.data : {};
      const existingAttendee = existingOrder.attendee && typeof existingOrder.attendee === "object" ? existingOrder.attendee : {};
      const attendeeEmail = normalizeEmail(existingAttendee.email || payload?.customer_email || payload?.customer?.email);
      const attendeeName = truncateText(existingAttendee.name || payload?.customer_name || payload?.customer?.name, 200) || "Attendee";
      const attendeePhone = truncateText(existingAttendee.phone || payload?.customer_phone || payload?.customer?.phone, 60);
      const transactionId = extractWebhookTransactionId(payload, req.body);
      const webhookAmount = toPositiveAmount(payload?.amount || req.body?.amount);
      const webhookCurrency = normalizeCurrency(payload?.currency || req.body?.currency || existingOrder?.currency || "USD");
      const wasAlreadyPaid = normalizeText(existingOrder?.paymentStatus).toLowerCase() === "paid";

      const updatedOrder = {
        ...existingOrder,
        id: existingOrder?.id || orderReference,
        attendee: {
          ...existingAttendee,
          name: attendeeName,
          email: attendeeEmail || existingAttendee.email || "",
          phone: attendeePhone
        },
        status: "Confirmed",
        paymentStatus: "Paid",
        paymentProvider: "NYVAPAY",
        total: webhookAmount || toPositiveAmount(existingOrder?.total),
        currency: webhookCurrency,
        ticketToken: truncateText(existingOrder?.ticketToken, 120) || generateTicketToken(),
        paidAt: truncateText(payload?.paid_at || payload?.paidAt || req.body?.created_at, 60) || new Date().toISOString(),
        nyvapay: {
          ...(existingOrder?.nyvapay && typeof existingOrder.nyvapay === "object" ? existingOrder.nyvapay : {}),
          status: "paid",
          transactionId,
          eventType: rawEventName || eventName,
          linkId: truncateText(payload?.link_id || payload?.linkId || existingOrder?.nyvapay?.linkId, 120),
          lastWebhookAt: new Date().toISOString()
        }
      };
      if (!updatedOrder.purchaseDate) {
        updatedOrder.purchaseDate = new Date().toISOString();
      }

      orderRow.attendeeEmail = attendeeEmail || orderRow.attendeeEmail || "";
      orderRow.data = updatedOrder;
      await orderRow.save();

      let attendeeEmailSent = false;
      let promoterEmailSent = false;
      if (!wasAlreadyPaid && isValidEmail(attendeeEmail)) {
        const promoterEmail = normalizeEmail(updatedOrder?.promoterEmail || payload?.metadata?.promoterEmail);
        const portalUrl = `/user-portal.html?email=${encodeURIComponent(attendeeEmail)}`;
        const userTemplate = ticketConfirmationTemplate({
          companyName,
          order: updatedOrder,
          portalUrl,
          supportEmail
        });
        const userDelivery = await sendTemplateEmail(attendeeEmail, userTemplate, "nyvapay-ticket-confirmation-user");
        attendeeEmailSent = Boolean(userDelivery.ok);

        if (isValidEmail(promoterEmail) && promoterEmail !== attendeeEmail) {
          const promoterTemplate = promoterSaleAlertTemplate({ companyName, order: updatedOrder });
          const promoterDelivery = await sendTemplateEmail(promoterEmail, promoterTemplate, "nyvapay-ticket-sale-promoter");
          promoterEmailSent = Boolean(promoterDelivery.ok);
        }
      }

      res.status(200).json({
        ok: true,
        orderId: orderReference,
        event: rawEventName || eventName,
        alreadyProcessed: wasAlreadyPaid,
        attendeeEmailSent,
        promoterEmailSent
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/bootstrap", attachOptionalAuth, async (req, res, next) => {
    try {
      const [events, promoterEvents] = await Promise.all([
        AppEvent.find({}).sort({ updatedAt: -1 }).lean(),
        PromoterEvent.find({}).sort({ updatedAt: -1 }).lean()
      ]);

      const basePayload = {
        ok: true,
        events: filterLegacyDemoEvents(events.map((item) => item.data)),
        promoterEvents: filterLegacyDemoEvents(promoterEvents.map((item) => item.data)),
        orders: [],
        userProfiles: {},
        userPaymentMethods: {},
        userFavorites: {},
        auth: req.auth ? authPayloadToUser(req.auth) : null
      };

      if (!req.auth) {
        res.status(200).json(basePayload);
        return;
      }

      const role = normalizeRole(req.auth.role);
      if (role === "admin") {
        const [orders, profiles, paymentMethods, favorites] = await Promise.all([
          OrderRecord.find({}).sort({ updatedAt: -1 }).lean(),
          UserProfile.find({}).lean(),
          UserPaymentMethods.find({}).lean(),
          UserFavorites.find({}).lean()
        ]);
        res.status(200).json({
          ...basePayload,
          orders: filterLegacyDemoOrders(orders.map((item) => item.data)),
          userProfiles: toProfileMap(profiles),
          userPaymentMethods: toMethodsMap(paymentMethods),
          userFavorites: toFavoritesMap(favorites)
        });
        return;
      }

      if (role === "user") {
        const email = normalizeEmail(req.auth.email);
        const [orders, profiles, paymentMethods, favorites] = await Promise.all([
          OrderRecord.find({ attendeeEmail: email }).sort({ updatedAt: -1 }).lean(),
          UserProfile.find({ email }).lean(),
          UserPaymentMethods.find({ email }).lean(),
          UserFavorites.find({ email }).lean()
        ]);
        res.status(200).json({
          ...basePayload,
          orders: filterLegacyDemoOrders(orders.map((item) => item.data)),
          userProfiles: toProfileMap(profiles),
          userPaymentMethods: toMethodsMap(paymentMethods),
          userFavorites: toFavoritesMap(favorites)
        });
        return;
      }

      if (role === "promoter") {
        const promoterEmail = normalizeEmail(req.auth.email);
        const ownedEventIds = new Set(
          filterLegacyDemoEvents(basePayload.promoterEvents)
            .filter((event) => normalizeEmail(event?.promoterEmail) === promoterEmail)
            .map((event) => String(event?.id || "").trim())
            .filter(Boolean)
        );
        const orders = await OrderRecord.find({}).sort({ updatedAt: -1 }).lean();
        const promoterOrders = filterLegacyDemoOrders(orders.map((item) => item.data))
          .filter((order) => orderBelongsToPromoter(order, promoterEmail, ownedEventIds));
        res.status(200).json({
          ...basePayload,
          orders: promoterOrders
        });
        return;
      }

      res.status(200).json(basePayload);
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/events", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const incoming = filterLegacyDemoEvents(ensureArray(req.body?.events).filter((item) => item && typeof item.id === "string"));
      const rows = [];
      const removeIds = [];
      incoming.forEach((item) => {
        const eventId = truncateText(item?.id, 120);
        if (!eventId) return;
        if (isLiveEventStatus(item?.status || "live")) {
          rows.push({
            eventId,
            data: {
              ...item,
              id: eventId,
              status: "Live"
            }
          });
          return;
        }
        removeIds.push(eventId);
      });
      const count = await upsertRows(AppEvent, rows, "eventId", (item) => ({ data: item.data }));
      let removed = 0;
      if (removeIds.length) {
        const removeResult = await AppEvent.deleteMany({ eventId: { $in: removeIds } });
        removed = Number(removeResult?.deletedCount || 0);
      }
      res.status(200).json({ ok: true, synced: count, removed });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/events/:eventId", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const eventId = String(req.params.eventId || "").trim();
      if (!eventId) {
        res.status(400).json({ ok: false, error: "eventId required" });
        return;
      }
      await AppEvent.deleteOne({ eventId });
      await PromoterEvent.deleteOne({ eventId });
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/promoter-events", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const incoming = filterLegacyDemoEvents(ensureArray(req.body?.promoterEvents).filter((item) => item && typeof item.id === "string"));
      const rows = incoming.map((item) => ({ eventId: item.id, data: item }));
      const count = await upsertRows(PromoterEvent, rows, "eventId", (item) => ({ data: item.data }));
      res.status(200).json({ ok: true, synced: count });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/orders", requireAuth, requireRoles("admin", "user", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      let incoming = filterLegacyDemoOrders(ensureArray(req.body?.orders).filter((item) => item && typeof item.id === "string"));
      if (role === "user") {
        incoming = incoming.filter((item) => normalizeEmail(item?.attendee?.email) === sessionEmail);
      } else if (role === "promoter") {
        const ownedEventIds = await getPromoterOwnedEventIds(sessionEmail);
        incoming = incoming.filter((item) => orderBelongsToPromoter(item, sessionEmail, ownedEventIds));
      }
      const rows = incoming.map((item) => ({
        orderId: item.id,
        attendeeEmail: normalizeEmail(item?.attendee?.email),
        data: item
      }));
      const count = await upsertRows(OrderRecord, rows, "orderId", (item) => ({
        attendeeEmail: item.attendeeEmail,
        data: item.data
      }));
      res.status(200).json({ ok: true, synced: count });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/user-profiles", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const profiles = req.body?.userProfiles;
      if (!profiles || typeof profiles !== "object") {
        res.status(400).json({ ok: false, error: "userProfiles must be an object map" });
        return;
      }

      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      let entries = Object.entries(profiles)
        .map(([email, data]) => ({ email: normalizeEmail(email), data }))
        .filter((item) => item.email);

      if (role === "user") {
        entries = entries.filter((item) => item.email === sessionEmail);
      }

      const count = await upsertRows(UserProfile, entries, "email", (item) => ({ data: item.data }));
      res.status(200).json({ ok: true, synced: count });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/user-payment-methods", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const methodsMap = req.body?.userPaymentMethods;
      if (!methodsMap || typeof methodsMap !== "object") {
        res.status(400).json({ ok: false, error: "userPaymentMethods must be an object map" });
        return;
      }

      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      let entries = Object.entries(methodsMap)
        .map(([email, methods]) => ({ email: normalizeEmail(email), methods: ensureArray(methods) }))
        .filter((item) => item.email);

      if (role === "user") {
        entries = entries.filter((item) => item.email === sessionEmail);
      }

      const count = await upsertRows(UserPaymentMethods, entries, "email", (item) => ({ methods: item.methods }));
      res.status(200).json({ ok: true, synced: count });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/user-favorites", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const favoritesMap = req.body?.userFavorites;
      if (!favoritesMap || typeof favoritesMap !== "object") {
        res.status(400).json({ ok: false, error: "userFavorites must be an object map" });
        return;
      }

      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      let entries = Object.entries(favoritesMap)
        .map(([email, eventIds]) => ({ email: normalizeEmail(email), eventIds: ensureArray(eventIds) }))
        .filter((item) => item.email);

      if (role === "user") {
        entries = entries.filter((item) => item.email === sessionEmail);
      }

      const count = await upsertRows(UserFavorites, entries, "email", (item) => ({ eventIds: item.eventIds }));
      res.status(200).json({ ok: true, synced: count });
    } catch (error) {
      next(error);
    }
  });

  router.get("/promoter/orders", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetPromoterEmail = role === "admin"
        ? normalizeEmail(req.query?.promoterEmail || sessionEmail)
        : sessionEmail;

      const ownedEventIds = await getPromoterOwnedEventIds(targetPromoterEmail);
      const orderRows = await OrderRecord.find({}).sort({ updatedAt: -1 }).lean();
      const orders = filterLegacyDemoOrders(orderRows.map((item) => item.data))
        .filter((order) => orderBelongsToPromoter(order, targetPromoterEmail, ownedEventIds));
      res.status(200).json({ ok: true, promoterEmail: targetPromoterEmail, orders });
    } catch (error) {
      next(error);
    }
  });

  router.get("/promoter/payout-account", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.query?.promoterEmail || sessionEmail)
        : sessionEmail;
      const row = await PromoterPayoutAccount.findOne({ email: targetEmail }).lean();
      res.status(200).json({
        ok: true,
        promoterEmail: targetEmail,
        payoutAccount: row?.data || null
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/promoter/payout-account", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.body?.promoterEmail || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid promoter email is required" });
        return;
      }

      const provider = truncateText(req.body?.provider, 80) || "NYVAPAY";
      const holder = truncateText(req.body?.holder || req.body?.accountHolder, 200);
      const payoutEmail = normalizeEmail(req.body?.email || req.body?.payoutEmail || targetEmail);
      const schedule = ["weekly", "monthly"].includes(normalizeText(req.body?.schedule).toLowerCase())
        ? normalizeText(req.body?.schedule).toLowerCase()
        : "weekly";

      if (!holder || !isValidEmail(payoutEmail)) {
        res.status(400).json({ ok: false, error: "Provider, account holder, and valid payout email are required" });
        return;
      }

      const payload = {
        provider,
        holder,
        payoutEmail,
        schedule,
        updatedAt: new Date().toISOString()
      };

      await PromoterPayoutAccount.updateOne(
        { email: targetEmail },
        {
          $set: {
            email: targetEmail,
            data: payload
          }
        },
        { upsert: true }
      );

      res.status(200).json({
        ok: true,
        promoterEmail: targetEmail,
        payoutAccount: payload
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/user/payment-methods", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.body?.email || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid user email is required" });
        return;
      }

      const provider = truncateText(req.body?.provider, 80);
      const last4 = String(req.body?.last4 || "").replace(/\D/g, "").slice(-4);
      const exp = truncateText(req.body?.exp, 16);
      if (!provider || last4.length !== 4 || !exp) {
        res.status(400).json({ ok: false, error: "provider, last4, and exp are required" });
        return;
      }

      const existing = await UserPaymentMethods.findOne({ email: targetEmail });
      const methods = ensureArray(existing?.methods);
      methods.unshift({
        provider,
        last4,
        exp,
        addedAt: new Date().toISOString()
      });

      await UserPaymentMethods.updateOne(
        { email: targetEmail },
        { $set: { email: targetEmail, methods: methods.slice(0, 12) } },
        { upsert: true }
      );

      res.status(200).json({
        ok: true,
        email: targetEmail,
        methods: methods.slice(0, 12)
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/user/payment-methods/:methodIndex", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.query?.email || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid user email is required" });
        return;
      }
      const parsedIndex = Number.parseInt(String(req.params?.methodIndex || ""), 10);
      if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
        res.status(400).json({ ok: false, error: "Valid methodIndex is required" });
        return;
      }
      const methodIndex = parsedIndex;
      const existing = await UserPaymentMethods.findOne({ email: targetEmail });
      const methods = ensureArray(existing?.methods);
      if (methodIndex >= methods.length) {
        res.status(404).json({ ok: false, error: "Payment method not found" });
        return;
      }
      methods.splice(methodIndex, 1);
      await UserPaymentMethods.updateOne(
        { email: targetEmail },
        { $set: { email: targetEmail, methods } },
        { upsert: true }
      );
      res.status(200).json({ ok: true, email: targetEmail, methods });
    } catch (error) {
      next(error);
    }
  });

  router.post("/orders/:orderId/refund-request", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const orderId = truncateText(req.params?.orderId, 120);
      if (!orderId) {
        res.status(400).json({ ok: false, error: "orderId is required" });
        return;
      }

      const row = await OrderRecord.findOne({ orderId });
      if (!row || !row.data || typeof row.data !== "object") {
        res.status(404).json({ ok: false, error: "Order not found" });
        return;
      }

      const order = row.data;
      const attendeeEmail = normalizeEmail(order?.attendee?.email);
      if (role === "user" && attendeeEmail !== sessionEmail) {
        res.status(403).json({ ok: false, error: "You can only request refunds for your own orders" });
        return;
      }
      if (!isSettledOrderData(order)) {
        res.status(400).json({ ok: false, error: "Refund request requires a paid order" });
        return;
      }

      order.status = "Refund Requested";
      order.paymentStatus = "Refund Requested";
      order.dispute = {
        ...(order.dispute && typeof order.dispute === "object" ? order.dispute : {}),
        type: "refund",
        status: "Open",
        requestedAt: new Date().toISOString(),
        requestedBy: sessionEmail || attendeeEmail
      };
      row.data = order;
      await row.save();

      res.status(200).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.post("/orders/:orderId/transfer-request", requireAuth, requireRoles("admin", "user"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const orderId = truncateText(req.params?.orderId, 120);
      const recipientEmail = normalizeEmail(req.body?.recipientEmail || req.body?.recipient);
      if (!orderId || !isValidEmail(recipientEmail)) {
        res.status(400).json({ ok: false, error: "orderId and valid recipientEmail are required" });
        return;
      }

      const row = await OrderRecord.findOne({ orderId });
      if (!row || !row.data || typeof row.data !== "object") {
        res.status(404).json({ ok: false, error: "Order not found" });
        return;
      }

      const order = row.data;
      const attendeeEmail = normalizeEmail(order?.attendee?.email);
      if (role === "user" && attendeeEmail !== sessionEmail) {
        res.status(403).json({ ok: false, error: "You can only request transfers for your own orders" });
        return;
      }
      if (!isSettledOrderData(order)) {
        res.status(400).json({ ok: false, error: "Transfer request requires a paid order" });
        return;
      }
      if (attendeeEmail === recipientEmail) {
        res.status(400).json({ ok: false, error: "Recipient email must be different from current attendee email" });
        return;
      }

      order.status = "Transfer Requested";
      order.transferRequest = {
        recipientEmail,
        status: "Pending",
        requestedAt: new Date().toISOString(),
        requestedBy: sessionEmail || attendeeEmail
      };
      order.dispute = {
        ...(order.dispute && typeof order.dispute === "object" ? order.dispute : {}),
        type: "transfer",
        status: "Open",
        requestedAt: new Date().toISOString(),
        requestedBy: sessionEmail || attendeeEmail
      };
      row.data = order;
      await row.save();

      res.status(200).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/ops/dashboard", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const [promoterAccounts, promoterEvents, orderRows, profileRows, payoutAccountRows] = await Promise.all([
        UserAccount.find({ role: "promoter" }).sort({ createdAt: -1 }).lean(),
        PromoterEvent.find({}).sort({ updatedAt: -1 }).lean(),
        OrderRecord.find({}).sort({ updatedAt: -1 }).lean(),
        UserProfile.find({}).lean(),
        PromoterPayoutAccount.find({}).lean()
      ]);

      const events = filterLegacyDemoEvents(promoterEvents.map((item) => item.data));
      const orders = filterLegacyDemoOrders(orderRows.map((item) => item.data));
      const profileMap = toProfileMap(profileRows);
      const payoutAccountMap = payoutAccountRows.reduce((acc, item) => {
        acc[item.email] = item.data || {};
        return acc;
      }, {});

      const latestEventByPromoter = {};
      events.forEach((event) => {
        const email = normalizeEmail(event?.promoterEmail);
        if (!email) return;
        const current = latestEventByPromoter[email];
        const eventDate = toDateOrNull(event?.createdAt || event?.date);
        const currentDate = toDateOrNull(current?.createdAt || current?.date);
        if (!current || (eventDate && (!currentDate || eventDate > currentDate))) {
          latestEventByPromoter[email] = event;
        }
      });

      const promoterApprovals = promoterAccounts.map((account) => {
        const email = normalizeEmail(account.email);
        const relatedEvent = latestEventByPromoter[email] || {};
        const location = truncateText(relatedEvent?.city || relatedEvent?.state || relatedEvent?.country, 120) || "—";
        return {
          id: String(account._id),
          name: account.name,
          email,
          location,
          submittedAt: account.createdAt,
          status: account.isActive ? "Approved" : "Pending"
        };
      });

      const pendingEvents = events
        .filter((event) => {
          const status = normalizeLifecycleStatus(event?.status);
          return isPendingReviewEventStatus(status);
        })
        .map((event) => ({
          eventId: truncateText(event?.id, 120),
          title: truncateText(event?.title, 200) || "Untitled Event",
          promoterEmail: normalizeEmail(event?.promoterEmail),
          category: truncateText(event?.category, 120) || "—",
          status: truncateText(event?.status, 40) || "Pending"
        }))
        .filter((event) => event.eventId);

      const attendeesByEmail = {};
      orders.forEach((order) => {
        const email = normalizeEmail(order?.attendee?.email);
        if (!email) return;
        const current = attendeesByEmail[email] || {
          name: truncateText(order?.attendee?.name, 200) || truncateText(profileMap[email]?.name, 200) || "Attendee",
          email,
          orders: 0,
          lastPurchase: ""
        };
        current.orders += Math.max(1, Math.floor(toFiniteNumber(order?.quantity, 1)));
        const purchaseDate = truncateText(order?.purchaseDate, 60) || "";
        if (!current.lastPurchase || purchaseDate > current.lastPurchase) {
          current.lastPurchase = purchaseDate;
        }
        attendeesByEmail[email] = current;
      });
      const attendeeRecords = Object.values(attendeesByEmail)
        .sort((a, b) => String(b.lastPurchase || "").localeCompare(String(a.lastPurchase || "")))
        .slice(0, 20);

      const payoutQueue = orders
        .filter((order) => {
          if (!isSettledOrderData(order)) return false;
          const payoutStatus = normalizeLifecycleStatus(order?.payoutStatus);
          return payoutStatus !== "processed";
        })
        .map((order) => {
          const promoterEmail = normalizeEmail(order?.promoterEmail);
          const payoutAccount = payoutAccountMap[promoterEmail] || {};
          return {
            orderId: truncateText(order?.id, 120),
            promoterEmail,
            promoterName: truncateText(payoutAccount?.holder, 200) || promoterEmail || "Unknown promoter",
            amount: toPositiveAmount(order?.total),
            payoutDate: addDays(order?.paidAt || order?.purchaseDate, 7),
            status: truncateText(order?.payoutStatus, 40) || "Scheduled"
          };
        })
        .filter((item) => item.orderId)
        .sort((a, b) => String(a.payoutDate || "").localeCompare(String(b.payoutDate || "")))
        .slice(0, 30);

      const disputes = orders
        .filter((order) => {
          const orderStatus = normalizeLifecycleStatus(order?.status);
          const paymentStatus = normalizeLifecycleStatus(order?.paymentStatus);
          const disputeStatus = normalizeLifecycleStatus(order?.dispute?.status);
          const transferStatus = normalizeLifecycleStatus(order?.transferRequest?.status);
          return orderStatus.includes("refund requested")
            || orderStatus.includes("transfer requested")
            || paymentStatus.includes("refund requested")
            || disputeStatus === "open"
            || transferStatus === "pending";
        })
        .map((order) => {
          const isTransfer = normalizeLifecycleStatus(order?.status).includes("transfer")
            || normalizeLifecycleStatus(order?.dispute?.type).includes("transfer");
          return {
            orderId: truncateText(order?.id, 120),
            caseId: `DSP-${truncateText(order?.id, 120)}`,
            type: isTransfer ? "Ticket Transfer" : "Refund",
            relatedEvent: truncateText(order?.eventTitle, 200) || "Unknown event",
            priority: isTransfer ? "Medium" : "High",
            status: "Open",
            requestedAt: truncateText(order?.dispute?.requestedAt || order?.purchaseDate, 60) || new Date().toISOString(),
            recipientEmail: normalizeEmail(order?.transferRequest?.recipientEmail),
            attendeeEmail: normalizeEmail(order?.attendee?.email)
          };
        })
        .slice(0, 30);

      res.status(200).json({
        ok: true,
        promoterApprovals,
        attendeeRecords,
        pendingEvents,
        payoutQueue,
        disputes,
        counts: {
          pendingPromoters: promoterApprovals.filter((item) => item.status === "Pending").length,
          pendingEvents: pendingEvents.length
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/promoters/:accountId/status", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const accountId = truncateText(req.params?.accountId, 120);
      const desired = normalizeLifecycleStatus(req.body?.status);
      if (!accountId || !["approved", "rejected", "suspended", "pending"].includes(desired)) {
        res.status(400).json({ ok: false, error: "Valid accountId and status are required" });
        return;
      }
      const account = await UserAccount.findOne({ _id: accountId, role: "promoter" });
      if (!account) {
        res.status(404).json({ ok: false, error: "Promoter account not found" });
        return;
      }
      account.isActive = desired === "approved";
      await account.save();
      res.status(200).json({ ok: true, accountId, status: account.isActive ? "Approved" : "Pending" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/events/:eventId/status", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const eventId = truncateText(req.params?.eventId, 120);
      const requestedStatus = normalizeLifecycleStatus(req.body?.status);
      let nextStatus = "";
      if (isLiveEventStatus(requestedStatus)) nextStatus = "Live";
      else if (requestedStatus === "paused") nextStatus = "Paused";
      else if (requestedStatus === "draft") nextStatus = "Draft";
      else if (requestedStatus.includes("reject")) nextStatus = "Rejected";
      else if (requestedStatus.includes("flag")) nextStatus = "Flagged";
      else if (isPendingReviewEventStatus(requestedStatus)) nextStatus = "Pending Approval";
      if (!eventId || !nextStatus) {
        res.status(400).json({ ok: false, error: "eventId and status are required" });
        return;
      }

      const [promoterRow, appRow] = await Promise.all([
        PromoterEvent.findOne({ eventId }),
        AppEvent.findOne({ eventId })
      ]);
      if (!promoterRow && !appRow) {
        res.status(404).json({ ok: false, error: "Event not found" });
        return;
      }
      if (promoterRow?.data && typeof promoterRow.data === "object") {
        promoterRow.data.status = nextStatus;
        await promoterRow.save();
      }
      if (nextStatus === "Live") {
        const sourceData = promoterRow?.data && typeof promoterRow.data === "object"
          ? promoterRow.data
          : appRow?.data && typeof appRow.data === "object"
            ? appRow.data
            : null;
        if (sourceData) {
          await AppEvent.updateOne(
            { eventId },
            {
              $set: {
                eventId,
                data: {
                  ...sourceData,
                  id: truncateText(sourceData?.id || eventId, 120) || eventId,
                  status: "Live"
                }
              }
            },
            { upsert: true }
          );
        }
      } else {
        await AppEvent.deleteOne({ eventId });
      }

      res.status(200).json({ ok: true, eventId, status: nextStatus });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/payouts/:orderId/process", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const orderId = truncateText(req.params?.orderId, 120);
      if (!orderId) {
        res.status(400).json({ ok: false, error: "orderId is required" });
        return;
      }
      const row = await OrderRecord.findOne({ orderId });
      if (!row || !row.data || typeof row.data !== "object") {
        res.status(404).json({ ok: false, error: "Order not found" });
        return;
      }
      row.data.payoutStatus = "Processed";
      row.data.payoutProcessedAt = new Date().toISOString();
      await row.save();
      res.status(200).json({ ok: true, order: row.data });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/disputes/:orderId/resolve", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const orderId = truncateText(req.params?.orderId, 120);
      const resolution = normalizeLifecycleStatus(req.body?.resolution || "rejected");
      const recipientEmail = normalizeEmail(req.body?.recipientEmail);
      if (!orderId) {
        res.status(400).json({ ok: false, error: "orderId is required" });
        return;
      }
      const row = await OrderRecord.findOne({ orderId });
      if (!row || !row.data || typeof row.data !== "object") {
        res.status(404).json({ ok: false, error: "Order not found" });
        return;
      }

      const order = row.data;
      const isTransfer = normalizeLifecycleStatus(order?.status).includes("transfer")
        || normalizeLifecycleStatus(order?.dispute?.type).includes("transfer");
      if (resolution === "approved") {
        if (isTransfer) {
          const nextRecipient = recipientEmail || normalizeEmail(order?.transferRequest?.recipientEmail);
          if (!isValidEmail(nextRecipient)) {
            res.status(400).json({ ok: false, error: "Valid recipientEmail is required to approve transfer requests" });
            return;
          }
          order.attendee = {
            ...(order.attendee && typeof order.attendee === "object" ? order.attendee : {}),
            email: nextRecipient
          };
          order.transferRequest = {
            ...(order.transferRequest && typeof order.transferRequest === "object" ? order.transferRequest : {}),
            recipientEmail: nextRecipient,
            status: "Completed",
            resolvedAt: new Date().toISOString()
          };
          row.attendeeEmail = nextRecipient;
          order.status = "Confirmed";
          order.paymentStatus = "Paid";
        } else {
          order.status = "Refunded";
          order.paymentStatus = "Refunded";
          order.refundedAt = new Date().toISOString();
        }
      } else {
        order.status = "Confirmed";
        order.paymentStatus = "Paid";
        if (order.transferRequest && typeof order.transferRequest === "object") {
          order.transferRequest.status = "Rejected";
          order.transferRequest.resolvedAt = new Date().toISOString();
        }
      }
      order.dispute = {
        ...(order.dispute && typeof order.dispute === "object" ? order.dispute : {}),
        status: "Resolved",
        resolution: resolution === "approved" ? "Approved" : "Rejected",
        resolvedAt: new Date().toISOString()
      };
      row.data = order;
      await row.save();
      res.status(200).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/ops/approve-all", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const promoterResult = await UserAccount.updateMany(
        { role: "promoter", isActive: false },
        { $set: { isActive: true } }
      );

      const eventRows = await PromoterEvent.find({}).lean();
      let eventsUpdated = 0;
      for (const row of eventRows) {
        const data = row?.data && typeof row.data === "object" ? row.data : null;
        if (!data) continue;
        const status = normalizeLifecycleStatus(data.status);
        if (isPendingReviewEventStatus(status)) {
          const liveData = {
            ...data,
            id: truncateText(data?.id || row.eventId, 120) || row.eventId,
            status: "Live"
          };
          await PromoterEvent.updateOne(
            { _id: row._id },
            { $set: { data: liveData } }
          );
          await AppEvent.updateOne(
            { eventId: row.eventId },
            { $set: { eventId: row.eventId, data: liveData } },
            { upsert: true }
          );
          eventsUpdated += 1;
        }
      }

      res.status(200).json({
        ok: true,
        promotersApproved: Number(promoterResult.modifiedCount || 0),
        eventsApproved: eventsUpdated
      });
    } catch (error) {
      next(error);
    }
  });

  router.use((err, _req, res, _next) => {
    res.status(500).json({
      ok: false,
      error: err?.message || "Server error"
    });
  });

  return router;
}

module.exports = createApiRouter;
