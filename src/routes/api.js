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
const NotificationLog = require("../models/NotificationLog");
const VenueBookingRequest = require("../models/VenueBookingRequest");
const HostBookingRequest = require("../models/HostBookingRequest");
const { sendEmail } = require("../services/mailer");
const {
  welcomeEmailTemplate,
  ticketConfirmationTemplate,
  promoterSaleAlertTemplate,
  promoterEventPublishedTemplate,
  promoterPendingApprovalTemplate,
  promoterStatusUpdateTemplate,
  eventModerationUpdateTemplate,
  orderLifecycleUpdateTemplate,
  payoutProcessedTemplate,
  adminQueueAlertTemplate
} = require("../services/emailTemplates");
const { createNyvapayPaymentLink, isNyvapayConfigured } = require("../services/nyvapay");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (["admin", "promoter", "user", "venue", "event_host", "artiste", "sponsor", "influencer"].includes(role)) return role;
  return "";
}

function roleLabel(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "admin") return "Admin";
  if (normalizedRole === "promoter") return "Promoter";
  if (normalizedRole === "venue") return "Venue";
  if (normalizedRole === "event_host") return "Event Host";
  if (normalizedRole === "artiste") return "Artiste";
  if (normalizedRole === "sponsor") return "Sponsor";
  if (normalizedRole === "influencer") return "Influencer";
  return "User";
}

function dashboardPathForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "admin") return "/admin.html";
  if (normalizedRole === "promoter") return "/promoter-dashboard.html";
  if (normalizedRole === "venue") return "/venue-dashboard.html";
  if (normalizedRole === "event_host") return "/host-dashboard.html";
  if (normalizedRole === "artiste") return "/artiste-dashboard.html";
  if (normalizedRole === "sponsor") return "/sponsor-dashboard.html";
  if (normalizedRole === "influencer") return "/influencer-dashboard.html";
  return "/user-portal.html";
}

function normalizePromoterAccountStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["pending", "approved", "rejected", "suspended"].includes(status)) return status;
  return "";
}

function resolvePromoterAccountStatus(account) {
  const explicit = normalizePromoterAccountStatus(account?.promoterStatus);
  if (explicit) return explicit;
  return account?.isActive ? "approved" : "pending";
}

function promoterAccountStatusLabel(value) {
  const status = normalizePromoterAccountStatus(value);
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "suspended") return "Suspended";
  return "Pending";
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

function normalizeDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function toCanonicalEventStatus(value) {
  const status = normalizeLifecycleStatus(value);
  if (isLiveEventStatus(status)) return "Live";
  if (status === "paused") return "Paused";
  if (status === "draft") return "Draft";
  if (status.includes("reject")) return "Rejected";
  if (status.includes("flag")) return "Flagged";
  if (isPendingReviewEventStatus(status)) return "Pending Approval";
  return "";
}

function normalizePromoterEventStatusForRole(role, requestedStatus, previousStatus) {
  const roleValue = normalizeRole(role);
  const requestedCanonical = toCanonicalEventStatus(requestedStatus);
  const previousCanonical = toCanonicalEventStatus(previousStatus) || "Pending Approval";
  if (roleValue !== "promoter") {
    return requestedCanonical || previousCanonical;
  }
  const wasLiveCapable = previousCanonical === "Live" || previousCanonical === "Paused";
  if (requestedCanonical === "Draft") return "Draft";
  if (requestedCanonical === "Pending Approval") return "Pending Approval";
  if (requestedCanonical === "Live" || requestedCanonical === "Paused") {
    return wasLiveCapable ? requestedCanonical : "Pending Approval";
  }
  if (requestedCanonical === "Flagged" || requestedCanonical === "Rejected") {
    return previousCanonical;
  }
  return wasLiveCapable ? previousCanonical : "Pending Approval";
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
      return {
        ok: false,
        skipped: true,
        reason: "send-failed",
        error: normalizeText(error?.message || "")
      };
    }
  }

  const notificationMaxAttempts = 2;
  const notificationRetryBaseMs = 350;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function absoluteUrlForPath(req, pathValue) {
    const base = appBaseUrlFromRequest(req);
    const normalizedPath = String(pathValue || "").trim();
    if (!normalizedPath) return "";
    if (isValidHttpUrl(normalizedPath)) return normalizedPath;
    if (!base) return normalizedPath;
    const pathname = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
    return `${base}${pathname}`;
  }

  function notificationKeySegment(value) {
    return normalizeText(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 120) || "na";
  }

  function buildNotificationIdempotencyKey(parts = []) {
    return parts.map((part) => notificationKeySegment(part)).join(":").slice(0, 240);
  }

  function isRetriableNotificationFailure(result) {
    const reason = normalizeText(result?.reason).toLowerCase();
    const error = normalizeText(result?.error).toLowerCase();
    if (!reason && !error) return false;
    if (reason.includes("request-failed") || reason.includes("api-error") || reason.includes("delivery-failed")) return true;
    if (reason.includes("send-failed")) return true;
    return error.includes("timed out") || error.includes("timeout") || error.includes("temporarily unavailable");
  }

  async function getPromoterNotificationPreferences(promoterEmail) {
    const email = normalizeEmail(promoterEmail);
    if (!isValidEmail(email)) return { notifySales: true, notifyPayouts: true };
    const profile = await UserProfile.findOne({ email }).lean();
    const data = profile?.data && typeof profile.data === "object" ? profile.data : {};
    return {
      notifySales: data.notifySales !== false,
      notifyPayouts: data.notifyPayouts !== false
    };
  }

  async function deliverTemplateWithLogging({
    idempotencyKey,
    category,
    templateName,
    contextLabel,
    recipientEmail,
    template,
    metadata = {}
  }) {
    const recipient = normalizeEmail(recipientEmail);
    const key = buildNotificationIdempotencyKey([idempotencyKey || category, recipient || "none"]);
    let log = await NotificationLog.findOne({ idempotencyKey: key });
    if (!log) {
      try {
        log = await NotificationLog.create({
          idempotencyKey: key,
          category: normalizeText(category) || "general",
          contextLabel: normalizeText(contextLabel) || "notification",
          templateName: normalizeText(templateName) || "template",
          recipientEmail: recipient || "invalid-recipient",
          status: "pending",
          attempts: 0,
          maxAttempts: notificationMaxAttempts,
          metadata
        });
      } catch (error) {
        if (Number(error?.code) === 11000) {
          log = await NotificationLog.findOne({ idempotencyKey: key });
        } else {
          throw error;
        }
      }
    }
    if (["sent", "skipped"].includes(normalizeLifecycleStatus(log?.status))) {
      return {
        ok: log.status === "sent",
        deduped: true,
        skipped: log.status === "skipped",
        reason: log.lastError || "already-processed"
      };
    }
    if (!log) {
      return { ok: false, skipped: true, reason: "notification-log-conflict" };
    }

    if (!isValidEmail(recipient)) {
      log.status = "skipped";
      log.lastError = "invalid-recipient";
      log.nextRetryAt = null;
      log.attempts = Math.max(1, toFiniteNumber(log.attempts, 0));
      await log.save();
      return { ok: false, skipped: true, reason: "invalid-recipient" };
    }

    let attempt = Math.max(0, toFiniteNumber(log.attempts, 0));
    while (attempt < notificationMaxAttempts) {
      attempt += 1;
      log.attempts = attempt;
      log.lastAttemptAt = new Date();
      log.status = "pending";
      await log.save();

      const result = await sendTemplateEmail(recipient, template, contextLabel);
      if (result?.ok) {
        log.status = "sent";
        log.sentAt = new Date();
        log.nextRetryAt = null;
        log.lastError = "";
        log.providerRequestId = normalizeText(result.requestId);
        await log.save();
        return { ok: true, sentTo: recipient };
      }
      if (normalizeText(result?.requestId)) {
        log.providerRequestId = normalizeText(result.requestId);
      }

      const retriable = attempt < notificationMaxAttempts && isRetriableNotificationFailure(result);
      if (retriable) {
        const backoffMs = notificationRetryBaseMs * (2 ** (attempt - 1));
        log.status = "pending";
        log.lastError = normalizeText(result?.error || result?.reason || "retry-scheduled");
        log.nextRetryAt = new Date(Date.now() + backoffMs);
        await log.save();
        await sleep(backoffMs);
        continue;
      }

      log.status = result?.skipped ? "skipped" : "failed";
      log.lastError = normalizeText(result?.error || result?.reason || "delivery-failed");
      log.nextRetryAt = null;
      await log.save();
      return {
        ok: false,
        skipped: Boolean(result?.skipped),
        reason: normalizeText(result?.error || result?.reason || "delivery-failed")
      };
    }

    log.status = "failed";
    log.lastError = log.lastError || "max-attempts-exceeded";
    log.nextRetryAt = null;
    await log.save();
    return { ok: false, skipped: false, reason: "max-attempts-exceeded" };
  }

  async function sendAdminQueueAlert(req, queueType, entityName, entityId, submittedBy, keySuffix = "") {
    const recipients = new Set();
    const normalizedSupport = normalizeEmail(supportEmail);
    const normalizedSeedAdmin = normalizeEmail(env.seedAdminEmail);
    if (isValidEmail(normalizedSupport)) recipients.add(normalizedSupport);
    if (isValidEmail(normalizedSeedAdmin)) recipients.add(normalizedSeedAdmin);
    const adminAccounts = await UserAccount.find({ role: "admin" }).select("email").lean();
    adminAccounts.forEach((account) => {
      const email = normalizeEmail(account?.email);
      if (isValidEmail(email)) recipients.add(email);
    });
    if (!recipients.size) return [];
    const queueTypeValue = normalizeLifecycleStatus(queueType);
    let adminPagePath = "/admin-promoters.html";
    if (queueTypeValue.includes("event")) adminPagePath = "/admin-events.html";
    else if (queueTypeValue.includes("payout")) adminPagePath = "/admin-payments.html";
    else if (queueTypeValue.includes("booking")) adminPagePath = "/admin-booking-requests.html";
    else if (queueTypeValue.includes("dispute") || queueTypeValue.includes("refund") || queueTypeValue.includes("transfer")) {
      adminPagePath = "/admin-disputes.html";
    }
    const adminUrl = absoluteUrlForPath(req, adminPagePath);
    const results = [];
    for (const recipient of recipients) {
      const template = adminQueueAlertTemplate({
        companyName,
        queueType,
        entityName,
        entityId,
        submittedBy,
        adminUrl
      });
      results.push(await deliverTemplateWithLogging({
        idempotencyKey: buildNotificationIdempotencyKey(["admin-queue", queueType, entityId, recipient, keySuffix]),
        category: "admin-queue-alert",
        templateName: "adminQueueAlertTemplate",
        contextLabel: "admin-queue-alert",
        recipientEmail: recipient,
        template,
        metadata: {
          queueType,
          entityId,
          submittedBy,
          adminUrl
        }
      }));
    }
    return results;
  }

  function resolveEventId(event) {
    return truncateText(event?.id || event?.eventId, 120);
  }

  function resolveEventShareLink(req, event) {
    const eventId = resolveEventId(event);
    if (!eventId) return "";
    return absoluteUrlForPath(req, `/checkout.html?event=${encodeURIComponent(eventId)}`);
  }

  async function deliverPromoterEventPublishedNotification(req, {
    promoterEmail,
    event,
    shareLink = "",
    source = "unknown"
  }) {
    const recipient = normalizeEmail(promoterEmail);
    if (!isValidEmail(recipient)) {
      return { ok: false, skipped: true, reason: "invalid-recipient" };
    }
    const eventId = resolveEventId(event) || "unknown-event";
    const normalizedShareLink = normalizeText(shareLink) || resolveEventShareLink(req, event);
    const template = promoterEventPublishedTemplate({
      companyName,
      event: {
        ...(event && typeof event === "object" ? event : {}),
        id: eventId
      },
      shareLink: normalizedShareLink
    });
    return deliverTemplateWithLogging({
      idempotencyKey: buildNotificationIdempotencyKey(["promoter-event-published", eventId, recipient]),
      category: "event-publication",
      templateName: "promoterEventPublishedTemplate",
      contextLabel: "promoter-event-published",
      recipientEmail: recipient,
      template,
      metadata: {
        eventId,
        promoterEmail: recipient,
        shareLink: normalizedShareLink,
        source
      }
    });
  }

  async function deliverEventModerationNotification(req, {
    promoterEmail,
    promoterName,
    event,
    status,
    shareLink = "",
    source = "unknown"
  }) {
    const recipient = normalizeEmail(promoterEmail);
    if (!isValidEmail(recipient)) {
      return { ok: false, skipped: true, reason: "invalid-recipient" };
    }
    const eventId = resolveEventId(event) || "unknown-event";
    const normalizedStatus = toCanonicalEventStatus(status) || truncateText(status, 40) || "Updated";
    const resolvedShareLink = normalizeText(shareLink) || resolveEventShareLink(req, event);
    const template = eventModerationUpdateTemplate({
      companyName,
      promoterName: truncateText(promoterName, 200) || "Promoter",
      event: {
        ...(event && typeof event === "object" ? event : {}),
        id: eventId
      },
      status: normalizedStatus,
      supportEmail,
      dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html"),
      shareLink: resolvedShareLink
    });
    return deliverTemplateWithLogging({
      idempotencyKey: buildNotificationIdempotencyKey(["event-moderation", eventId, normalizedStatus, recipient]),
      category: "event-moderation",
      templateName: "eventModerationUpdateTemplate",
      contextLabel: "event-moderation-status",
      recipientEmail: recipient,
      template,
      metadata: {
        eventId,
        promoterEmail: recipient,
        status: normalizedStatus,
        shareLink: resolvedShareLink,
        source
      }
    });
  }

  function buildOrderLifecycleRecipientView(order, recipientEmail, recipientName = "") {
    const existingAttendee = order?.attendee && typeof order.attendee === "object" ? order.attendee : {};
    return {
      ...(order && typeof order === "object" ? order : {}),
      attendee: {
        ...existingAttendee,
        name: truncateText(recipientName || existingAttendee?.name, 200) || "there",
        email: normalizeEmail(recipientEmail) || normalizeEmail(existingAttendee?.email)
      }
    };
  }

  async function deliverOrderLifecycleNotification(req, {
    order,
    stage,
    recipientEmail,
    recipientName = "",
    source = "unknown",
    metadata = {}
  }) {
    const recipient = normalizeEmail(recipientEmail);
    if (!isValidEmail(recipient)) {
      return { ok: false, skipped: true, reason: "invalid-recipient" };
    }
    const orderId = truncateText(order?.id, 120) || "unknown-order";
    const portalUrl = absoluteUrlForPath(req, `/user-portal.html?email=${encodeURIComponent(recipient)}`);
    const template = orderLifecycleUpdateTemplate({
      companyName,
      order: buildOrderLifecycleRecipientView(order, recipient, recipientName),
      stage,
      supportEmail,
      portalUrl,
      recipientEmail: normalizeEmail(metadata?.recipientEmail || "")
    });
    return deliverTemplateWithLogging({
      idempotencyKey: buildNotificationIdempotencyKey(["order-lifecycle", orderId, stage, recipient]),
      category: "order-lifecycle",
      templateName: "orderLifecycleUpdateTemplate",
      contextLabel: `order-lifecycle-${stage}`,
      recipientEmail: recipient,
      template,
      metadata: {
        orderId,
        stage,
        recipientEmail: recipient,
        source,
        ...metadata
      }
    });
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

  function orderEventDateTime(order) {
    const eventDate = normalizeText(order?.eventDate);
    const eventTime = normalizeText(order?.eventTime || "00:00");
    if (!eventDate) return null;
    const parsed = new Date(`${eventDate}T${eventTime}:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function canRequestRefundForOrder(order) {
    const status = normalizeLifecycleStatus(order?.status);
    if (status !== "confirmed") return false;
    const eventDateTime = orderEventDateTime(order);
    if (!eventDateTime) return false;
    const diffMs = eventDateTime.getTime() - Date.now();
    return diffMs >= 48 * 60 * 60 * 1000;
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
      const country = truncateText(req.body?.country, 120);

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
      const isPromoterAccount = role === "promoter";
      if (isPromoterAccount && !country) {
        res.status(400).json({ ok: false, error: "Country is required for promoter registration" });
        return;
      }
      const account = await UserAccount.create({
        name: name || email.split("@")[0],
        email,
        role,
        passwordHash,
        promoterStatus: isPromoterAccount ? "pending" : "approved",
        isActive: isPromoterAccount ? false : true,
        lastLoginAt: isPromoterAccount ? null : new Date()
      });
      if (isPromoterAccount) {
        await UserProfile.updateOne(
          { email },
          {
            $set: {
              email,
              data: {
                name: account.name,
                email,
                country,
                location: country,
                notifySales: true,
                notifyPayouts: true
              }
            }
          },
          { upsert: true }
        );
        const pendingTemplate = promoterPendingApprovalTemplate({
          companyName,
          name: account.name,
          supportEmail,
          dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html")
        });
        await deliverTemplateWithLogging({
          idempotencyKey: buildNotificationIdempotencyKey(["promoter-registration-pending", account._id]),
          category: "promoter-moderation",
          templateName: "promoterPendingApprovalTemplate",
          contextLabel: "promoter-registration-pending",
          recipientEmail: account.email,
          template: pendingTemplate,
          metadata: {
            accountId: String(account._id),
            status: "pending"
          }
        });
        await sendAdminQueueAlert(
          req,
          "Promoter Approvals",
          account.name,
          String(account._id),
          account.email,
          "registration"
        );
        res.status(201).json({
          ok: true,
          requiresApproval: true,
          approvalStatus: "Pending",
          message: "Promoter account created and pending admin approval.",
          user: {
            id: String(account._id),
            name: account.name,
            email: account.email,
            role: account.role
          }
        });
        return;
      }

      if (role !== "user") {
        await UserProfile.updateOne(
          { email },
          {
            $set: {
              email,
              data: {
                name: account.name,
                email,
                role,
                country,
                location: country || "",
                notifySales: true,
                notifyPayouts: true
              }
            }
          },
          { upsert: true }
        );
      }

      const welcomeTemplate = welcomeEmailTemplate({
        companyName,
        name: account.name,
        role: account.role,
        dashboardUrl: absoluteUrlForPath(req, dashboardPathForRole(account.role))
      });
      await deliverTemplateWithLogging({
        idempotencyKey: buildNotificationIdempotencyKey(["welcome", account.role, account._id]),
        category: "account",
        templateName: "welcomeEmailTemplate",
        contextLabel: `welcome-${account.role}`,
        recipientEmail: account.email,
        template: welcomeTemplate,
        metadata: {
          accountId: String(account._id),
          role: account.role
        }
      });

      const tokenBundle = await issueTokenBundle(account, req);
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
      if (!account) {
        res.status(401).json({ ok: false, error: "Invalid credentials", errorCode: "INVALID_CREDENTIALS" });
        return;
      }
      if (account.role === "promoter") {
        const promoterStatus = resolvePromoterAccountStatus(account);
        if (promoterStatus === "pending") {
          res.status(403).json({
            ok: false,
            error: "Promoter account is pending admin approval.",
            errorCode: "PROMOTER_PENDING_APPROVAL"
          });
          return;
        }
        if (promoterStatus === "rejected") {
          res.status(403).json({
            ok: false,
            error: "Promoter account was rejected. Contact support for next steps.",
            errorCode: "PROMOTER_REJECTED"
          });
          return;
        }
        if (promoterStatus === "suspended") {
          res.status(403).json({
            ok: false,
            error: "Promoter account is suspended. Contact support to restore access.",
            errorCode: "PROMOTER_SUSPENDED"
          });
          return;
        }
      }
      if (!account.isActive) {
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

  router.post("/notifications/ticket-confirmation", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const order = req.body?.order || {};
      const attendeeEmail = normalizeEmail(order?.attendee?.email);
      const scopedPromoterEmail = role === "promoter" ? sessionEmail : "";
      const promoterEmail = normalizeEmail(req.body?.promoterEmail || order?.promoterEmail || scopedPromoterEmail);

      if (!isValidEmail(attendeeEmail)) {
        res.status(400).json({ ok: false, error: "Valid attendee email is required" });
        return;
      }
      if (role === "promoter" && promoterEmail !== sessionEmail) {
        res.status(403).json({ ok: false, error: "Promoters can only send notifications for their own account scope" });
        return;
      }

      const orderId = truncateText(order?.id, 120) || "unknown-order";
      const portalUrl = absoluteUrlForPath(req, `/user-portal.html?email=${encodeURIComponent(attendeeEmail)}`);
      const userTemplate = ticketConfirmationTemplate({
        companyName,
        order,
        portalUrl,
        supportEmail
      });
      const userDelivery = await deliverTemplateWithLogging({
        idempotencyKey: buildNotificationIdempotencyKey(["ticket-confirmation", orderId, attendeeEmail]),
        category: "order-confirmation",
        templateName: "ticketConfirmationTemplate",
        contextLabel: "ticket-confirmation-user",
        recipientEmail: attendeeEmail,
        template: userTemplate,
        metadata: {
          orderId,
          attendeeEmail,
          source: "notifications-ticket-confirmation-endpoint"
        }
      });

      let promoterDelivery = { ok: false, skipped: true, reason: "not-requested" };
      if (isValidEmail(promoterEmail) && promoterEmail !== attendeeEmail) {
        const preferences = await getPromoterNotificationPreferences(promoterEmail);
        if (preferences.notifySales) {
          const promoterTemplate = promoterSaleAlertTemplate({ companyName, order });
          promoterDelivery = await deliverTemplateWithLogging({
            idempotencyKey: buildNotificationIdempotencyKey(["ticket-sale-alert", orderId, promoterEmail]),
            category: "promoter-sales",
            templateName: "promoterSaleAlertTemplate",
            contextLabel: "ticket-sale-promoter",
            recipientEmail: promoterEmail,
            template: promoterTemplate,
            metadata: {
              orderId,
              promoterEmail,
              source: "notifications-ticket-confirmation-endpoint"
            }
          });
        } else {
          promoterDelivery = { ok: false, skipped: true, reason: "promoter-notify-sales-disabled" };
        }
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
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const event = req.body?.event || {};
      const shareLink = normalizeText(req.body?.shareLink || "");
      const scopedPromoterEmail = role === "promoter" ? sessionEmail : "";
      const promoterEmail = normalizeEmail(req.body?.promoterEmail || event?.promoterEmail || scopedPromoterEmail);

      if (!isValidEmail(promoterEmail)) {
        res.status(400).json({ ok: false, error: "Valid promoter email is required" });
        return;
      }
      if (role === "promoter" && promoterEmail !== sessionEmail) {
        res.status(403).json({ ok: false, error: "Promoters can only send notifications for their own account scope" });
        return;
      }
      const delivery = await deliverPromoterEventPublishedNotification(req, {
        promoterEmail,
        event,
        shareLink,
        source: "notifications-promoter-event-published-endpoint"
      });

      res.status(200).json({
        ok: true,
        promoterEmail,
        emailSent: Boolean(delivery.ok),
        deduped: Boolean(delivery?.deduped)
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
        const orderId = truncateText(updatedOrder?.id || orderReference, 120) || orderReference;
        const promoterEmail = normalizeEmail(updatedOrder?.promoterEmail || payload?.metadata?.promoterEmail);
        const portalUrl = absoluteUrlForPath(req, `/user-portal.html?email=${encodeURIComponent(attendeeEmail)}`);
        const userTemplate = ticketConfirmationTemplate({
          companyName,
          order: updatedOrder,
          portalUrl,
          supportEmail
        });
        const userDelivery = await deliverTemplateWithLogging({
          idempotencyKey: buildNotificationIdempotencyKey(["ticket-confirmation", orderId, attendeeEmail]),
          category: "order-confirmation",
          templateName: "ticketConfirmationTemplate",
          contextLabel: "ticket-confirmation-user",
          recipientEmail: attendeeEmail,
          template: userTemplate,
          metadata: {
            orderId,
            attendeeEmail,
            source: "nyvapay-payment-succeeded-webhook"
          }
        });
        attendeeEmailSent = Boolean(userDelivery.ok);

        if (isValidEmail(promoterEmail) && promoterEmail !== attendeeEmail) {
          const preferences = await getPromoterNotificationPreferences(promoterEmail);
          if (preferences.notifySales) {
            const promoterTemplate = promoterSaleAlertTemplate({ companyName, order: updatedOrder });
            const promoterDelivery = await deliverTemplateWithLogging({
              idempotencyKey: buildNotificationIdempotencyKey(["ticket-sale-alert", orderId, promoterEmail]),
              category: "promoter-sales",
              templateName: "promoterSaleAlertTemplate",
              contextLabel: "nyvapay-ticket-sale-promoter",
              recipientEmail: promoterEmail,
              template: promoterTemplate,
              metadata: {
                orderId,
                promoterEmail,
                source: "nyvapay-payment-succeeded-webhook"
              }
            });
            promoterEmailSent = Boolean(promoterDelivery.ok);
          }
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
      const publicEvents = filterLegacyDemoEvents(events.map((item) => item.data));
      const allPromoterEvents = filterLegacyDemoEvents(promoterEvents.map((item) => item.data));

      const basePayload = {
        ok: true,
        events: publicEvents,
        promoterEvents: [],
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
          promoterEvents: allPromoterEvents,
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
        const promoterScopedEvents = allPromoterEvents.filter((event) => normalizeEmail(event?.promoterEmail) === promoterEmail);
        const ownedEventIds = new Set(
          promoterScopedEvents
            .map((event) => String(event?.id || "").trim())
            .filter(Boolean)
        );
        const orders = await OrderRecord.find({}).sort({ updatedAt: -1 }).lean();
        const promoterOrders = filterLegacyDemoOrders(orders.map((item) => item.data))
          .filter((order) => orderBelongsToPromoter(order, promoterEmail, ownedEventIds));
        res.status(200).json({
          ...basePayload,
          promoterEvents: promoterScopedEvents,
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
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const incoming = filterLegacyDemoEvents(ensureArray(req.body?.events).filter((item) => item && typeof item.id === "string"));
      const rows = [];
      const removeIds = [];
      const unauthorizedIds = [];
      const incomingEventIds = incoming
        .map((item) => truncateText(item?.id, 120))
        .filter(Boolean);
      const promoterRows = role === "promoter" && incomingEventIds.length
        ? await PromoterEvent.find({ eventId: { $in: incomingEventIds } }).lean()
        : [];
      const promoterByEventId = new Map(promoterRows.map((row) => [row?.eventId, row?.data && typeof row.data === "object" ? row.data : {}]));
      incoming.forEach((item) => {
        const eventId = truncateText(item?.id, 120);
        if (!eventId) return;
        const incomingStatus = normalizeLifecycleStatus(item?.status);
        if (!isLiveEventStatus(incomingStatus)) {
          removeIds.push(eventId);
          return;
        }
        if (role === "promoter") {
          const promoterEvent = promoterByEventId.get(eventId);
          const promoterEventStatus = normalizeLifecycleStatus(promoterEvent?.status);
          const ownerEmail = normalizeEmail(promoterEvent?.promoterEmail);
          if (!promoterEvent || (ownerEmail && ownerEmail !== sessionEmail)) {
            unauthorizedIds.push(eventId);
            return;
          }
          if (!isLiveEventStatus(promoterEventStatus)) {
            removeIds.push(eventId);
            return;
          }
        }
        rows.push({
          eventId,
          data: {
            ...item,
            id: eventId,
            status: "Live"
          }
        });
      });
      if (unauthorizedIds.length) {
        res.status(403).json({ ok: false, error: "Cannot sync events outside your promoter account scope" });
        return;
      }
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
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const deleteScope = normalizeLifecycleStatus(req.query?.scope || req.query?.mode || "");
      const wantsHardDelete = deleteScope === "all" || deleteScope === "full" || deleteScope === "hard";
      if (wantsHardDelete && role !== "admin") {
        res.status(403).json({ ok: false, error: "Only admins can hard-delete promoter event records" });
        return;
      }

      const [appRow, promoterRow] = await Promise.all([
        AppEvent.findOne({ eventId }).lean(),
        PromoterEvent.findOne({ eventId }).lean()
      ]);

      if (role === "promoter" && (appRow || promoterRow)) {
        const promoterOwnerEmail = normalizeEmail(promoterRow?.data?.promoterEmail);
        const appOwnerEmail = normalizeEmail(appRow?.data?.promoterEmail);
        const ownerEmail = promoterOwnerEmail || appOwnerEmail;
        if (!sessionEmail || (ownerEmail && ownerEmail !== sessionEmail)) {
          res.status(403).json({ ok: false, error: "Cannot delete events outside your promoter account scope" });
          return;
        }
      }

      const removedMarketplace = Number((await AppEvent.deleteOne({ eventId }))?.deletedCount || 0);
      let removedPromoter = 0;
      if (role === "admin" && wantsHardDelete) {
        removedPromoter = Number((await PromoterEvent.deleteOne({ eventId }))?.deletedCount || 0);
      }

      res.status(200).json({
        ok: true,
        eventId,
        scope: role === "admin" && wantsHardDelete ? "all" : "marketplace",
        removedMarketplace,
        removedPromoter
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sync/promoter-events", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      if (role === "promoter" && !sessionEmail) {
        res.status(403).json({ ok: false, error: "Authenticated promoter email is required" });
        return;
      }
      const incoming = filterLegacyDemoEvents(ensureArray(req.body?.promoterEvents).filter((item) => item && typeof item.id === "string"));
      const incomingEventIds = incoming
        .map((item) => truncateText(item?.id, 120))
        .filter(Boolean);
      const existingRows = incomingEventIds.length
        ? await PromoterEvent.find({ eventId: { $in: incomingEventIds } }).lean()
        : [];
      const existingByEventId = new Map(existingRows.map((row) => [row?.eventId, row?.data && typeof row.data === "object" ? row.data : {}]));
      const unauthorizedIds = [];
      const pendingQueueAlertItems = [];
      const rows = incoming
        .map((item) => {
          const eventId = truncateText(item?.id, 120);
          if (!eventId) return null;
          const existingEvent = existingByEventId.get(eventId) || {};
          const existingOwnerEmail = normalizeEmail(existingEvent?.promoterEmail);
          if (role === "promoter" && existingOwnerEmail && existingOwnerEmail !== sessionEmail) {
            unauthorizedIds.push(eventId);
            return null;
          }
          const resolvedStatus = normalizePromoterEventStatusForRole(role, item?.status, existingEvent?.status);
          const resolvedPromoterEmail = role === "promoter"
            ? sessionEmail
            : normalizeEmail(item?.promoterEmail || existingOwnerEmail || "");
          const isPendingNow = isPendingReviewEventStatus(resolvedStatus);
          const wasPending = isPendingReviewEventStatus(existingEvent?.status);
          if (role === "promoter" && isPendingNow && !wasPending) {
            pendingQueueAlertItems.push({
              eventId,
              title: truncateText(item?.title || existingEvent?.title, 200) || "Untitled Event",
              promoterEmail: resolvedPromoterEmail || sessionEmail
            });
          }
          return {
            eventId,
            data: {
              ...item,
              id: eventId,
              status: resolvedStatus,
              promoterEmail: resolvedPromoterEmail
            }
          };
        })
        .filter(Boolean);
      if (unauthorizedIds.length) {
        res.status(403).json({ ok: false, error: "Cannot modify promoter events outside your account scope" });
        return;
      }
      const count = await upsertRows(PromoterEvent, rows, "eventId", (item) => ({ data: item.data }));
      for (const pendingItem of pendingQueueAlertItems) {
        await sendAdminQueueAlert(
          req,
          "Promoter Event Review",
          pendingItem.title,
          pendingItem.eventId,
          pendingItem.promoterEmail,
          "event-submission"
        );
      }
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

      const bankName = truncateText(req.body?.bankName, 200);
      const bankAddress = truncateText(req.body?.bankAddress, 240);
      const city = truncateText(req.body?.city || req.body?.bankCity, 120);
      const stateProvince = truncateText(req.body?.stateProvince || req.body?.provinceState || req.body?.state, 120);
      const country = truncateText(req.body?.country, 120);
      const accountHolderName = truncateText(req.body?.accountHolderName || req.body?.holder || req.body?.accountHolder, 200);
      const bankAccountNumber = truncateText(req.body?.bankAccountNumber, 120);
      const routingNumber = truncateText(req.body?.routingNumber, 120);
      const swiftCode = truncateText(req.body?.swiftCode, 120);
      const schedule = ["weekly", "monthly"].includes(normalizeText(req.body?.schedule).toLowerCase())
        ? normalizeText(req.body?.schedule).toLowerCase()
        : "weekly";
      if (
        !bankName
        || !bankAddress
        || !city
        || !stateProvince
        || !country
        || !accountHolderName
        || !bankAccountNumber
        || !routingNumber
        || !swiftCode
      ) {
        res.status(400).json({ ok: false, error: "All bank transfer fields are required" });
        return;
      }

      const payload = {
        provider: "Bank Transfer",
        bankName,
        bankAddress,
        city,
        stateProvince,
        country,
        accountHolderName,
        bankAccountNumber,
        routingNumber,
        swiftCode,
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

  router.get("/promoter/profile", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.query?.promoterEmail || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid promoter email is required" });
        return;
      }

      const account = await UserAccount.findOne({ email: targetEmail, role: "promoter" }).lean();
      if (!account) {
        res.status(404).json({ ok: false, error: "Promoter account not found" });
        return;
      }
      const profileRow = await UserProfile.findOne({ email: targetEmail }).lean();
      const profileData = profileRow?.data && typeof profileRow.data === "object" ? profileRow.data : {};
      const profile = {
        name: truncateText(profileData?.name || account.name, 200) || account.name,
        email: targetEmail,
        phone: truncateText(profileData?.phone, 80),
        location: truncateText(profileData?.location, 200),
        country: truncateText(profileData?.country || profileData?.location, 120),
        notifySales: profileData?.notifySales !== false,
        notifyPayouts: profileData?.notifyPayouts !== false
      };
      res.status(200).json({
        ok: true,
        promoterEmail: targetEmail,
        profile
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/promoter/profile", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const targetEmail = role === "admin"
        ? normalizeEmail(req.body?.promoterEmail || req.body?.email || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid promoter email is required" });
        return;
      }

      const account = await UserAccount.findOne({ email: targetEmail, role: "promoter" });
      if (!account) {
        res.status(404).json({ ok: false, error: "Promoter account not found" });
        return;
      }

      const profile = {
        name: truncateText(req.body?.name || account.name, 200) || account.name,
        email: targetEmail,
        phone: truncateText(req.body?.phone, 80),
        location: truncateText(req.body?.location, 200),
        country: truncateText(req.body?.country || req.body?.location, 120),
        notifySales: req.body?.notifySales !== false,
        notifyPayouts: req.body?.notifyPayouts !== false
      };

      await UserProfile.updateOne(
        { email: targetEmail },
        { $set: { email: targetEmail, data: profile } },
        { upsert: true }
      );
      if (profile.name && profile.name !== account.name) {
        account.name = profile.name;
        await account.save();
      }

      res.status(200).json({
        ok: true,
        promoterEmail: targetEmail,
        profile
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/portal/profile", requireAuth, requireRoles("admin", "promoter", "venue", "event_host", "artiste", "sponsor", "influencer"), async (req, res, next) => {
    try {
      const sessionRole = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const requestedRole = normalizeRole(req.query?.role || req.query?.accountRole || "");
      const targetRole = sessionRole === "admin" ? requestedRole : sessionRole;
      const targetEmail = sessionRole === "admin"
        ? normalizeEmail(req.query?.email || req.query?.accountEmail || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid email is required" });
        return;
      }

      const accountFilter = { email: targetEmail };
      if (targetRole) accountFilter.role = targetRole;
      const account = await UserAccount.findOne(accountFilter).lean();
      if (!account) {
        res.status(404).json({ ok: false, error: "Account not found for requested portal profile" });
        return;
      }
      const profileRow = await UserProfile.findOne({ email: targetEmail }).lean();
      const profileData = profileRow?.data && typeof profileRow.data === "object" ? profileRow.data : {};
      const profile = {
        name: truncateText(profileData?.name || account.name, 200) || account.name,
        email: targetEmail,
        role: normalizeRole(account.role),
        phone: truncateText(profileData?.phone, 80),
        location: truncateText(profileData?.location, 200),
        country: truncateText(profileData?.country || profileData?.location, 120),
        notifySales: profileData?.notifySales !== false,
        notifyPayouts: profileData?.notifyPayouts !== false,
        data: profileData
      };
      res.status(200).json({ ok: true, profile });
    } catch (error) {
      next(error);
    }
  });

  router.post("/portal/profile", requireAuth, requireRoles("admin", "promoter", "venue", "event_host", "artiste", "sponsor", "influencer"), async (req, res, next) => {
    try {
      const sessionRole = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const requestedRole = normalizeRole(req.body?.role || req.body?.accountRole || "");
      const targetRole = sessionRole === "admin" ? requestedRole : sessionRole;
      const targetEmail = sessionRole === "admin"
        ? normalizeEmail(req.body?.email || req.body?.accountEmail || sessionEmail)
        : sessionEmail;
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ ok: false, error: "Valid email is required" });
        return;
      }

      const accountFilter = { email: targetEmail };
      if (targetRole) accountFilter.role = targetRole;
      const account = await UserAccount.findOne(accountFilter);
      if (!account) {
        res.status(404).json({ ok: false, error: "Account not found for requested portal profile" });
        return;
      }

      const existingProfileRow = await UserProfile.findOne({ email: targetEmail }).lean();
      const existingData = existingProfileRow?.data && typeof existingProfileRow.data === "object"
        ? existingProfileRow.data
        : {};
      const incomingData = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
      const mergedData = {
        ...existingData,
        ...incomingData,
        name: truncateText(req.body?.name || incomingData?.name || existingData?.name || account.name, 200) || account.name,
        email: targetEmail,
        role: normalizeRole(account.role),
        phone: truncateText(req.body?.phone || incomingData?.phone || existingData?.phone, 80),
        location: truncateText(req.body?.location || incomingData?.location || existingData?.location, 200),
        country: truncateText(req.body?.country || incomingData?.country || existingData?.country || existingData?.location, 120),
        notifySales: req.body?.notifySales !== undefined ? req.body.notifySales !== false : (existingData?.notifySales !== false),
        notifyPayouts: req.body?.notifyPayouts !== undefined ? req.body.notifyPayouts !== false : (existingData?.notifyPayouts !== false),
        updatedAt: new Date().toISOString()
      };
      if (!mergedData.location && mergedData.country) mergedData.location = mergedData.country;

      await UserProfile.updateOne(
        { email: targetEmail },
        { $set: { email: targetEmail, data: mergedData } },
        { upsert: true }
      );
      if (mergedData.name && mergedData.name !== account.name) {
        account.name = mergedData.name;
        await account.save();
      }

      res.status(200).json({
        ok: true,
        profile: {
          name: mergedData.name,
          email: targetEmail,
          role: normalizeRole(account.role),
          phone: mergedData.phone || "",
          location: mergedData.location || "",
          country: mergedData.country || "",
          notifySales: mergedData.notifySales !== false,
          notifyPayouts: mergedData.notifyPayouts !== false,
          data: mergedData
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/hosts/marketplace", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const queryFilter = truncateText(req.query?.q || req.query?.name, 160).toLowerCase();
      const cityFilter = truncateText(req.query?.city, 120).toLowerCase();
      const countryFilter = truncateText(req.query?.country, 120).toLowerCase();
      const minCost = Math.max(0, toFiniteNumber(req.query?.minCost, 0));
      const maxCost = Math.max(0, toFiniteNumber(req.query?.maxCost, 0));
      const eventDateRaw = truncateText(req.query?.eventDate || req.query?.date, 40);
      const eventDateKey = normalizeDateKey(eventDateRaw);
      const hasDateFilter = Boolean(eventDateKey);
      const availabilityByHost = new Map();

      const hostAccounts = await UserAccount.find({ role: "event_host", isActive: true }).sort({ createdAt: -1 }).lean();
      const hostEmails = hostAccounts.map((item) => normalizeEmail(item?.email)).filter(Boolean);
      const profileRows = hostEmails.length ? await UserProfile.find({ email: { $in: hostEmails } }).lean() : [];
      const profileByEmail = new Map(profileRows.map((row) => [normalizeEmail(row?.email), row?.data && typeof row.data === "object" ? row.data : {}]));

      if (hasDateFilter) {
        const datePattern = new RegExp(`^${escapeRegex(eventDateKey)}`, "i");
        const bookingRows = await HostBookingRequest.find({
          status: { $regex: /^(Accepted|Pending)$/i },
          "data.eventDate": { $regex: datePattern }
        }).select("hostEmail status").lean();
        bookingRows.forEach((row) => {
          const hostEmail = normalizeEmail(row?.hostEmail);
          if (!hostEmail) return;
          const status = normalizeLifecycleStatus(row?.status);
          if (status === "accepted") {
            availabilityByHost.set(hostEmail, "Booked");
            return;
          }
          if (!availabilityByHost.has(hostEmail)) {
            availabilityByHost.set(hostEmail, "Pending");
          }
        });
      }

      const hosts = hostAccounts
        .map((account) => {
          const email = normalizeEmail(account?.email);
          const profileData = profileByEmail.get(email) || {};
          const bookingCost = toPositiveAmount(profileData?.bookingCost);
          const blockedDates = ensureArray(profileData?.blockedDates)
            .map((item) => normalizeDateKey(item))
            .filter(Boolean);
          const uniqueBlockedDates = [...new Set(blockedDates)].sort((a, b) => a.localeCompare(b));
          
          let availability = "";
          if (hasDateFilter) {
            const bookedStatus = availabilityByHost.get(email) || "";
            const isBlocked = uniqueBlockedDates.includes(eventDateKey);
            if (bookedStatus === "Booked") availability = "Booked";
            else if (isBlocked) availability = "Blocked";
            else if (bookedStatus === "Pending") availability = "Pending";
            else availability = "Available";
          }

          return {
            name: truncateText(profileData?.name || account?.name, 200) || "Host",
            email,
            city: truncateText(profileData?.city, 120),
            country: truncateText(profileData?.country, 120),
            location: truncateText(profileData?.location || profileData?.country, 200),
            bookingCost,
            bio: truncateText(profileData?.bio, 500),
            image: truncateText(profileData?.image || profileData?.profileImage, 500),
            availability: hasDateFilter ? availability : undefined,
            blockedDates: uniqueBlockedDates.slice(0, 31),
            blockedDatesTotal: uniqueBlockedDates.length
          };
        })
        .filter((host) => !queryFilter || `${host.name} ${host.email}`.toLowerCase().includes(queryFilter))
        .filter((host) => !cityFilter || String(host.city || "").toLowerCase() === cityFilter)
        .filter((host) => !countryFilter || String(host.country || "").toLowerCase() === countryFilter)
        .filter((host) => !minCost || host.bookingCost >= minCost)
        .filter((host) => !maxCost || host.bookingCost <= maxCost);

      res.status(200).json({ ok: true, count: hosts.length, hosts });
    } catch (error) {
      next(error);
    }
  });

  router.post("/hosts/requests", requireAuth, requireRoles("admin", "promoter"), async (req, res, next) => {
    try {
      const promoterEmail = normalizeEmail(req.auth?.email);
      const hostEmail = normalizeEmail(req.body?.hostEmail);
      if (!isValidEmail(hostEmail)) {
        res.status(400).json({ ok: false, error: "Valid hostEmail is required" });
        return;
      }
      const hostAccount = await UserAccount.findOne({ email: hostEmail, role: "event_host", isActive: true }).lean();
      if (!hostAccount) {
        res.status(404).json({ ok: false, error: "Host account not found" });
        return;
      }

      const eventName = truncateText(req.body?.eventName, 200);
      const eventDate = truncateText(req.body?.eventDate, 40);
      const offerPrice = toPositiveAmount(req.body?.offerPrice);
      if (!eventName || !eventDate || !offerPrice) {
        res.status(400).json({ ok: false, error: "eventName, eventDate, and offerPrice are required" });
        return;
      }

      const requestId = `hreq-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const requestData = {
        requestId,
        hostEmail,
        promoterEmail,
        status: "Pending",
        data: {
          eventName,
          eventDate,
          promoterName: truncateText(req.body?.promoterName || req.auth?.name, 200),
          offerPrice,
          message: truncateText(req.body?.message || "", 1000)
        }
      };
      await HostBookingRequest.create(requestData);
      res.status(201).json({ ok: true, request: requestData });
    } catch (error) {
      next(error);
    }
  });

  router.get("/hosts/requests", requireAuth, requireRoles("admin", "promoter", "event_host"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const filter = {};
      if (role === "event_host") {
        filter.hostEmail = sessionEmail;
      } else if (role === "promoter") {
        filter.promoterEmail = sessionEmail;
      }
      const rows = await HostBookingRequest.find(filter).sort({ createdAt: -1 }).limit(300).lean();
      const requests = rows.map((row) => ({
        requestId: row.requestId,
        hostEmail: row.hostEmail,
        promoterEmail: row.promoterEmail,
        status: row.status,
        actionReason: row.actionReason,
        actedAt: row.actedAt,
        createdAt: row.createdAt,
        data: row.data || {}
      }));
      res.status(200).json({ ok: true, count: requests.length, requests });
    } catch (error) {
      next(error);
    }
  });

  router.post("/hosts/requests/:requestId/status", requireAuth, requireRoles("admin", "event_host"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const requestId = truncateText(req.params?.requestId, 120);
      const requestedStatus = normalizeLifecycleStatus(req.body?.status);
      const nextStatus = requestedStatus === "accept" || requestedStatus === "accepted"
        ? "Accepted"
        : requestedStatus === "decline" || requestedStatus === "declined"
          ? "Declined"
          : "";
      if (!requestId || !nextStatus) {
        res.status(400).json({ ok: false, error: "Valid requestId and status are required" });
        return;
      }

      const row = await HostBookingRequest.findOne({ requestId });
      if (!row) {
        res.status(404).json({ ok: false, error: "Host booking request not found" });
        return;
      }
      if (role === "event_host" && normalizeEmail(row.hostEmail) !== sessionEmail) {
        res.status(403).json({ ok: false, error: "Cannot update requests outside your scope" });
        return;
      }
      row.status = nextStatus;
      row.actionReason = truncateText(req.body?.reason, 400);
      row.actedAt = new Date();
      await row.save();
      res.status(200).json({ ok: true, request: row });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/marketplace", requireAuth, requireRoles("admin", "promoter", "event_host", "artiste", "venue"), async (req, res, next) => {
    try {
      const cityFilter = truncateText(req.query?.city, 120).toLowerCase();
      const countryFilter = truncateText(req.query?.country, 120).toLowerCase();
      const minCapacity = Math.max(0, Math.floor(toFiniteNumber(req.query?.minCapacity, 0)));
      const maxCapacity = Math.max(0, Math.floor(toFiniteNumber(req.query?.maxCapacity, 0)));
      const maxPrice = Math.max(0, toFiniteNumber(req.query?.maxPrice, 0));
      const eventDateRaw = truncateText(req.query?.eventDate || req.query?.date, 40);
      const eventDateKey = normalizeDateKey(eventDateRaw);
      const hasDateFilter = Boolean(eventDateKey);
      const availabilityByVenue = new Map();

      const venueAccounts = await UserAccount.find({ role: "venue", isActive: true }).sort({ createdAt: -1 }).lean();
      const venueEmails = venueAccounts.map((item) => normalizeEmail(item?.email)).filter(Boolean);
      const profileRows = venueEmails.length ? await UserProfile.find({ email: { $in: venueEmails } }).lean() : [];
      const profileByEmail = new Map(profileRows.map((row) => [normalizeEmail(row?.email), row?.data && typeof row.data === "object" ? row.data : {}]));
      if (hasDateFilter) {
        const datePattern = new RegExp(`^${escapeRegex(eventDateKey)}`, "i");
        const bookingRows = await VenueBookingRequest.find({
          status: { $regex: /^(Accepted|Pending)$/i },
          "data.eventDate": { $regex: datePattern }
        }).select("venueEmail status").lean();
        bookingRows.forEach((row) => {
          const venueEmail = normalizeEmail(row?.venueEmail);
          if (!venueEmail) return;
          const status = normalizeLifecycleStatus(row?.status);
          if (status === "accepted") {
            availabilityByVenue.set(venueEmail, "Booked");
            return;
          }
          if (!availabilityByVenue.has(venueEmail)) {
            availabilityByVenue.set(venueEmail, "Pending");
          }
        });
      }

      const venues = venueAccounts
        .map((account) => {
          const email = normalizeEmail(account?.email);
          const profileData = profileByEmail.get(email) || {};
          const capacity = Math.max(0, Math.floor(toFiniteNumber(profileData?.capacity, 0)));
          const hourlyRate = toPositiveAmount(profileData?.hourlyRate);
          const dailyRate = toPositiveAmount(profileData?.dailyRate);
          const blockedDates = ensureArray(profileData?.blockedDates)
            .map((item) => normalizeDateKey(item))
            .filter(Boolean);
          const uniqueBlockedDates = [...new Set(blockedDates)].sort((a, b) => a.localeCompare(b));
          const blockedDatesTotal = uniqueBlockedDates.length;
          const blockedDatesForResponse = uniqueBlockedDates.slice(0, 31);
          let availability = "";
          if (hasDateFilter) {
            const bookedStatus = availabilityByVenue.get(email) || "";
            const isBlocked = uniqueBlockedDates.includes(eventDateKey);
            if (bookedStatus === "Booked") availability = "Booked";
            else if (isBlocked) availability = "Blocked";
            else if (bookedStatus === "Pending") availability = "Pending";
            else availability = "Available";
          }
          return {
            accountId: String(account?._id || ""),
            venueName: truncateText(profileData?.venueName || account?.name, 200) || "Untitled Venue",
            email,
            city: truncateText(profileData?.city, 120),
            state: truncateText(profileData?.state || profileData?.provinceState, 120),
            country: truncateText(profileData?.country, 120),
            address: truncateText(profileData?.address, 240),
            capacity,
            amenities: ensureArray(profileData?.amenities).map((item) => truncateText(item, 80)).filter(Boolean),
            pricing: {
              hourlyRate,
              dailyRate,
              weekendSurcharge: toPositiveAmount(profileData?.weekendSurcharge),
              cleaningFee: toPositiveAmount(profileData?.cleaningFee),
              currency: truncateText(profileData?.currency, 12) || "USD"
            },
            isPublished: profileData?.isPublished !== false,
            availability: hasDateFilter ? availability : undefined,
            blockedDates: blockedDatesForResponse,
            blockedDatesTotal
          };
        })
        .filter((venue) => venue.isPublished)
        .filter((venue) => !cityFilter || String(venue.city || "").toLowerCase() === cityFilter)
        .filter((venue) => !countryFilter || String(venue.country || "").toLowerCase() === countryFilter)
        .filter((venue) => !minCapacity || venue.capacity >= minCapacity)
        .filter((venue) => !maxCapacity || venue.capacity <= maxCapacity)
        .filter((venue) => !maxPrice || venue.pricing.hourlyRate <= maxPrice || venue.pricing.dailyRate <= maxPrice)
        .sort((a, b) => String(a.venueName || "").localeCompare(String(b.venueName || "")));

      res.status(200).json({ ok: true, count: venues.length, venues });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/requests", requireAuth, requireRoles("admin", "promoter", "event_host", "artiste"), async (req, res, next) => {
    try {
      const requesterEmail = normalizeEmail(req.auth?.email);
      const requesterRole = normalizeRole(req.auth?.role);
      const venueEmail = normalizeEmail(req.body?.venueEmail);
      if (!isValidEmail(venueEmail)) {
        res.status(400).json({ ok: false, error: "Valid venueEmail is required" });
        return;
      }
      const venueAccount = await UserAccount.findOne({ email: venueEmail, role: "venue", isActive: true }).lean();
      if (!venueAccount) {
        res.status(404).json({ ok: false, error: "Venue account not found" });
        return;
      }

      const eventName = truncateText(req.body?.eventName || req.body?.title, 200);
      const eventDate = truncateText(req.body?.date || req.body?.eventDate, 40);
      const estimatedAttendees = Math.max(1, Math.floor(toFiniteNumber(req.body?.estimatedAttendees, 1)));
      const proposedPrice = toPositiveAmount(req.body?.proposedPrice || req.body?.budget);
      if (!eventName || !eventDate || !proposedPrice) {
        res.status(400).json({ ok: false, error: "eventName, eventDate, and proposedPrice are required" });
        return;
      }

      const requestId = `vreq-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const requestData = {
        requestId,
        venueEmail,
        requesterEmail,
        requesterRole,
        status: "Pending",
        data: {
          eventName,
          eventDate,
          promoterName: truncateText(req.body?.promoterName || req.body?.requesterName || req.auth?.name, 200) || "Requester",
          estimatedAttendees,
          proposedPrice,
          message: truncateText(req.body?.message || "", 1000),
          chatThread: []
        }
      };
      await VenueBookingRequest.create(requestData);
      await sendAdminQueueAlert(
        req,
        "Venue Booking Requests",
        eventName,
        requestId,
        requesterEmail || req.auth?.name || "requester",
        "venue-booking-request"
      );
      res.status(201).json({ ok: true, request: requestData });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/requests", requireAuth, requireRoles("admin", "venue", "promoter", "event_host", "artiste"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const statusFilter = normalizeLifecycleStatus(req.query?.status || "");
      const filter = {};
      if (role === "venue") {
        filter.venueEmail = sessionEmail;
      } else if (role === "promoter" || role === "event_host" || role === "artiste") {
        filter.requesterEmail = sessionEmail;
      } else if (role === "admin") {
        const venueEmail = normalizeEmail(req.query?.venueEmail);
        const requesterEmail = normalizeEmail(req.query?.requesterEmail);
        if (isValidEmail(venueEmail)) filter.venueEmail = venueEmail;
        if (isValidEmail(requesterEmail)) filter.requesterEmail = requesterEmail;
      }
      if (statusFilter) {
        filter.status = new RegExp(`^${statusFilter}$`, "i");
      }
      const rows = await VenueBookingRequest.find(filter).sort({ createdAt: -1 }).limit(300).lean();
      const requests = rows.map((row) => ({
        requestId: truncateText(row?.requestId, 120),
        venueEmail: normalizeEmail(row?.venueEmail),
        requesterEmail: normalizeEmail(row?.requesterEmail),
        requesterRole: normalizeRole(row?.requesterRole),
        requesterRoleLabel: roleLabel(row?.requesterRole),
        status: truncateText(row?.status, 40) || "Pending",
        actionReason: truncateText(row?.actionReason, 400),
        actedByEmail: normalizeEmail(row?.actedByEmail),
        actedAt: row?.actedAt || null,
        createdAt: row?.createdAt || null,
        data: row?.data && typeof row.data === "object" ? row.data : {}
      }));
      res.status(200).json({ ok: true, count: requests.length, requests });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/requests/:requestId/status", requireAuth, requireRoles("admin", "venue"), async (req, res, next) => {
    try {
      const role = normalizeRole(req.auth?.role);
      const sessionEmail = normalizeEmail(req.auth?.email);
      const requestId = truncateText(req.params?.requestId, 120);
      const requestedStatus = normalizeLifecycleStatus(req.body?.status);
      const nextStatus = requestedStatus === "accept" || requestedStatus === "accepted"
        ? "Accepted"
        : requestedStatus === "decline" || requestedStatus === "declined"
          ? "Declined"
          : requestedStatus === "pending"
            ? "Pending"
            : "";
      if (!requestId || !nextStatus) {
        res.status(400).json({ ok: false, error: "Valid requestId and status are required" });
        return;
      }

      const row = await VenueBookingRequest.findOne({ requestId });
      if (!row) {
        res.status(404).json({ ok: false, error: "Venue booking request not found" });
        return;
      }
      if (role === "venue" && normalizeEmail(row.venueEmail) !== sessionEmail) {
        res.status(403).json({ ok: false, error: "Cannot update requests outside your venue scope" });
        return;
      }
      row.status = nextStatus;
      row.actionReason = truncateText(req.body?.reason || req.body?.declineReason, 400);
      row.actedByEmail = sessionEmail;
      row.actedAt = new Date();
      if (!row.data || typeof row.data !== "object") row.data = {};
      if (nextStatus === "Accepted") {
        row.data.calendarBlocked = true;
        row.data.contractSentAt = new Date().toISOString();
      }
      await row.save();
      res.status(200).json({
        ok: true,
        request: {
          requestId: row.requestId,
          venueEmail: normalizeEmail(row.venueEmail),
          requesterEmail: normalizeEmail(row.requesterEmail),
          requesterRole: normalizeRole(row.requesterRole),
          status: row.status,
          actionReason: row.actionReason,
          actedByEmail: normalizeEmail(row.actedByEmail),
          actedAt: row.actedAt,
          createdAt: row.createdAt,
          data: row.data
        }
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
      if (!canRequestRefundForOrder(order)) {
        res.status(400).json({
          ok: false,
          error: "Refund requests are only allowed for confirmed upcoming events at least 48 hours away."
        });
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
      await deliverOrderLifecycleNotification(req, {
        order,
        stage: "refund-requested",
        recipientEmail: attendeeEmail,
        source: "order-refund-request"
      });
      await sendAdminQueueAlert(
        req,
        "Refund Requests",
        truncateText(order?.eventTitle, 200) || `Order ${orderId}`,
        orderId,
        attendeeEmail || sessionEmail,
        "refund-request"
      );

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
      await deliverOrderLifecycleNotification(req, {
        order,
        stage: "transfer-requested",
        recipientEmail: attendeeEmail,
        source: "order-transfer-request",
        metadata: {
          recipientEmail
        }
      });
      await sendAdminQueueAlert(
        req,
        "Transfer Requests",
        truncateText(order?.eventTitle, 200) || `Order ${orderId}`,
        orderId,
        attendeeEmail || sessionEmail,
        "transfer-request"
      );

      res.status(200).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/ops/dashboard", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const [promoterAccounts, userAccounts, promoterEvents, orderRows, profileRows, payoutAccountRows, venueAccounts, partnerAccounts, bookingRequestRows] = await Promise.all([
        UserAccount.find({ role: "promoter" }).sort({ createdAt: -1 }).lean(),
        UserAccount.find({ role: "user" }).sort({ createdAt: -1 }).lean(),
        PromoterEvent.find({}).sort({ updatedAt: -1 }).lean(),
        OrderRecord.find({}).sort({ updatedAt: -1 }).lean(),
        UserProfile.find({}).lean(),
        PromoterPayoutAccount.find({}).lean(),
        UserAccount.find({ role: "venue" }).sort({ createdAt: -1 }).lean(),
        UserAccount.find({ role: { $in: ["event_host", "artiste", "sponsor", "influencer"] } }).sort({ createdAt: -1 }).lean(),
        VenueBookingRequest.find({}).sort({ createdAt: -1 }).lean()
      ]);

      const events = filterLegacyDemoEvents(promoterEvents.map((item) => {
        const eventData = item?.data && typeof item.data === "object" ? item.data : {};
        const resolvedEventId = truncateText(eventData?.id || item?.eventId, 120);
        return {
          ...eventData,
          id: resolvedEventId || "",
          eventId: resolvedEventId || ""
        };
      }));
      const orders = filterLegacyDemoOrders(orderRows.map((item) => item.data));
      const profileMap = toProfileMap(profileRows);
      const payoutAccountMap = payoutAccountRows.reduce((acc, item) => {
        acc[item.email] = item.data || {};
        return acc;
      }, {});
      const accountByEmail = promoterAccounts.reduce((acc, account) => {
        acc[normalizeEmail(account?.email)] = account;
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
      const publishedEventsByPromoter = {};
      events.forEach((event) => {
        if (!isLiveEventStatus(event?.status)) return;
        const promoterEmail = normalizeEmail(event?.promoterEmail);
        if (!promoterEmail) return;
        if (!publishedEventsByPromoter[promoterEmail]) publishedEventsByPromoter[promoterEmail] = [];
        publishedEventsByPromoter[promoterEmail].push({
          eventId: truncateText(event?.id || event?.eventId, 120),
          title: truncateText(event?.title, 200) || "Untitled Event",
          date: truncateText(event?.date, 40),
          status: truncateText(event?.status, 40) || "Live",
          city: truncateText(event?.city, 120),
          state: truncateText(event?.state, 120),
          country: truncateText(event?.country, 120),
          venue: truncateText(event?.venue, 200)
        });
      });

      const promoterApprovals = promoterAccounts.map((account) => {
        const email = normalizeEmail(account.email);
        const profileData = profileMap[email] || {};
        const relatedEvent = latestEventByPromoter[email] || {};
        const country = truncateText(profileData?.country || profileData?.location || relatedEvent?.country, 120) || "—";
        const promoterStatus = resolvePromoterAccountStatus(account);
        return {
          id: String(account._id),
          name: account.name,
          email,
          country,
          publishedEventsCount: ensureArray(publishedEventsByPromoter[email]).length,
          submittedAt: account.createdAt,
          status: promoterAccountStatusLabel(promoterStatus)
        };
      });

      const pendingEvents = events
        .filter((event) => {
          const status = normalizeLifecycleStatus(event?.status);
          return isPendingReviewEventStatus(status);
        })
        .map((event) => ({
          eventId: truncateText(event?.id || event?.eventId, 120),
          title: truncateText(event?.title, 200) || "Untitled Event",
          promoterEmail: normalizeEmail(event?.promoterEmail),
          category: truncateText(event?.category, 120) || "—",
          status: truncateText(event?.status, 40) || "Pending"
        }))
        .filter((event) => event.eventId);

      const eventRecords = events
        .map((event) => ({
          eventId: truncateText(event?.id || event?.eventId, 120),
          title: truncateText(event?.title, 200) || "Untitled Event",
          promoterEmail: normalizeEmail(event?.promoterEmail),
          category: truncateText(event?.category, 120) || "—",
          status: truncateText(event?.status, 40) || "Pending"
        }))
        .filter((event) => event.eventId);

      const attendeesByEmail = {};
      userAccounts.forEach((account) => {
        const email = normalizeEmail(account?.email);
        if (!email) return;
        const profileData = profileMap[email] || {};
        attendeesByEmail[email] = {
          name: truncateText(account?.name || profileData?.name, 200) || "Attendee",
          email,
          orders: 0,
          lastPurchase: "",
          createdAt: truncateText(account?.createdAt, 60) || ""
        };
      });
      orders.forEach((order) => {
        const email = normalizeEmail(order?.attendee?.email);
        if (!email) return;
        const current = attendeesByEmail[email] || {
          name: truncateText(order?.attendee?.name, 200) || truncateText(profileMap[email]?.name, 200) || "Attendee",
          email,
          orders: 0,
          lastPurchase: "",
          createdAt: ""
        };
        current.orders += Math.max(1, Math.floor(toFiniteNumber(order?.quantity, 1)));
        const purchaseDate = truncateText(order?.purchaseDate, 60) || "";
        if (!current.lastPurchase || purchaseDate > current.lastPurchase) {
          current.lastPurchase = purchaseDate;
        }
        attendeesByEmail[email] = current;
      });
      const attendeeRecords = Object.values(attendeesByEmail)
        .sort((a, b) => {
          const aKey = String(a.lastPurchase || a.createdAt || "");
          const bKey = String(b.lastPurchase || b.createdAt || "");
          return bKey.localeCompare(aKey);
        })
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
            promoterName: truncateText(payoutAccount?.accountHolderName || payoutAccount?.holder, 200) || promoterEmail || "Unknown promoter",
            amount: toPositiveAmount(order?.total),
            payoutDate: addDays(order?.paidAt || order?.purchaseDate, 7),
            status: truncateText(order?.payoutStatus, 40) || "Scheduled"
          };
        })
        .filter((item) => item.orderId)
        .sort((a, b) => String(a.payoutDate || "").localeCompare(String(b.payoutDate || "")))
        .slice(0, 30);
      const promoterMetricsByEmail = {};
      const eventPerformanceById = {};
      orders.forEach((order) => {
        if (!isSettledOrderData(order)) return;
        const promoterEmail = normalizeEmail(order?.promoterEmail);
        if (!promoterEmail) return;
        if (!promoterMetricsByEmail[promoterEmail]) {
          promoterMetricsByEmail[promoterEmail] = {
            ticketsSold: 0,
            revenue: 0,
            payouts: 0
          };
        }
        const qty = Math.max(1, Math.floor(toFiniteNumber(order?.quantity, 1)));
        const total = toPositiveAmount(order?.total);
        const payoutStatus = normalizeLifecycleStatus(order?.payoutStatus);
        const eventId = truncateText(order?.eventId, 120);
        promoterMetricsByEmail[promoterEmail].ticketsSold += qty;
        promoterMetricsByEmail[promoterEmail].revenue += total;
        if (payoutStatus === "processed") {
          promoterMetricsByEmail[promoterEmail].payouts += total;
        }
        if (eventId) {
          if (!eventPerformanceById[eventId]) {
            eventPerformanceById[eventId] = {
              ticketsSold: 0,
              revenue: 0
            };
          }
          eventPerformanceById[eventId].ticketsSold += qty;
          eventPerformanceById[eventId].revenue += total;
        }
      });
      const promoterEmails = new Set([
        ...promoterAccounts.map((account) => normalizeEmail(account?.email)).filter(Boolean),
        ...Object.keys(promoterMetricsByEmail),
        ...Object.keys(publishedEventsByPromoter)
      ]);
      const promoterPayoutDetails = [...promoterEmails].map((email) => {
        const account = accountByEmail[email] || null;
        const profileData = profileMap[email] || {};
        const payoutAccount = payoutAccountMap[email] || {};
        const accountNumber = String(payoutAccount?.bankAccountNumber || "").replace(/\s+/g, "");
        const metrics = promoterMetricsByEmail[email] || { ticketsSold: 0, revenue: 0, payouts: 0 };
        const publishedEvents = ensureArray(publishedEventsByPromoter[email]);
        return {
          accountId: account ? String(account._id) : "",
          promoterName: truncateText(account?.name || profileData?.name, 200) || email || "Unknown promoter",
          promoterEmail: email,
          country: truncateText(profileData?.country || profileData?.location, 120) || "—",
          ticketsSold: Math.max(0, Math.floor(toFiniteNumber(metrics?.ticketsSold, 0))),
          revenue: toPositiveAmount(metrics?.revenue),
          payouts: toPositiveAmount(metrics?.payouts),
          publishedEventsCount: publishedEvents.length,
          payoutAccount: {
            provider: truncateText(payoutAccount?.provider, 80) || "Bank Transfer",
            bankName: truncateText(payoutAccount?.bankName, 200),
            bankAddress: truncateText(payoutAccount?.bankAddress, 240),
            city: truncateText(payoutAccount?.city, 120),
            stateProvince: truncateText(payoutAccount?.stateProvince || payoutAccount?.provinceState || payoutAccount?.state, 120),
            accountHolderName: truncateText(payoutAccount?.accountHolderName || payoutAccount?.holder, 200),
            country: truncateText(payoutAccount?.country, 120),
            bankAccountNumber: truncateText(payoutAccount?.bankAccountNumber, 120),
            bankAccountNumberMasked: accountNumber ? `••••${accountNumber.slice(-4)}` : "",
            routingNumber: truncateText(payoutAccount?.routingNumber, 120),
            swiftCode: truncateText(payoutAccount?.swiftCode, 120),
            schedule: truncateText(payoutAccount?.schedule, 40)
          }
        };
      })
        .sort((a, b) => b.revenue - a.revenue);
      const promoterPublishedEvents = [...promoterEmails].map((email) => {
        const account = accountByEmail[email] || null;
        const profileData = profileMap[email] || {};
        const publishedEvents = ensureArray(publishedEventsByPromoter[email]);
        const eventsWithPerformance = publishedEvents
          .map((event) => {
            const eventId = truncateText(event?.eventId, 120);
            const performance = eventId ? eventPerformanceById[eventId] : null;
            return {
              ...event,
              ticketsSold: Math.max(0, Math.floor(toFiniteNumber(performance?.ticketsSold, 0))),
              revenue: toPositiveAmount(performance?.revenue)
            };
          })
          .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
        return {
          accountId: account ? String(account._id) : "",
          promoterName: truncateText(account?.name || profileData?.name, 200) || email || "Unknown promoter",
          promoterEmail: email,
          country: truncateText(profileData?.country || profileData?.location, 120) || "—",
          publishedEventsCount: eventsWithPerformance.length,
          events: eventsWithPerformance
        };
      })
        .sort((a, b) => b.publishedEventsCount - a.publishedEventsCount);
      const venueRecords = venueAccounts.map((account) => {
        const email = normalizeEmail(account?.email);
        const profileData = profileMap[email] || {};
        const accountStatus = resolvePromoterAccountStatus(account);
        let statusLabel = promoterAccountStatusLabel(accountStatus);
        if (statusLabel === "Approved" && profileData?.isPublished === false) {
          statusLabel = "Pending";
        }
        return {
          accountId: String(account?._id || ""),
          name: truncateText(profileData?.venueName || profileData?.name || account?.name, 200) || "Venue",
          email,
          city: truncateText(profileData?.city, 120),
          state: truncateText(profileData?.state || profileData?.provinceState, 120),
          country: truncateText(profileData?.country || profileData?.location, 120),
          capacity: Math.max(0, Math.floor(toFiniteNumber(profileData?.capacity, 0))),
          isPublished: profileData?.isPublished !== false,
          status: statusLabel,
          createdAt: account?.createdAt || null
        };
      });
      const bookingRequests = bookingRequestRows.map((row) => ({
        requestId: truncateText(row?.requestId, 120),
        venueEmail: normalizeEmail(row?.venueEmail),
        requesterEmail: normalizeEmail(row?.requesterEmail),
        requesterRole: normalizeRole(row?.requesterRole),
        requesterRoleLabel: roleLabel(row?.requesterRole),
        status: truncateText(row?.status, 40) || "Pending",
        eventName: truncateText(row?.data?.eventName, 200) || "Untitled Event",
        eventDate: truncateText(row?.data?.eventDate, 40),
        estimatedAttendees: Math.max(0, Math.floor(toFiniteNumber(row?.data?.estimatedAttendees, 0))),
        proposedPrice: toPositiveAmount(row?.data?.proposedPrice),
        actionReason: truncateText(row?.actionReason, 400),
        createdAt: row?.createdAt || null,
        actedAt: row?.actedAt || null
      }));
      const partnerRoleRecords = partnerAccounts.map((account) => {
        const email = normalizeEmail(account?.email);
        const profileData = profileMap[email] || {};
        const accountStatus = resolvePromoterAccountStatus(account);
        return {
          accountId: String(account?._id || ""),
          name: truncateText(profileData?.name || account?.name, 200) || "Portal User",
          email,
          role: normalizeRole(account?.role),
          roleLabel: roleLabel(account?.role),
          status: promoterAccountStatusLabel(accountStatus),
          isActive: account?.isActive !== false,
          country: truncateText(profileData?.country || profileData?.location, 120),
          city: truncateText(profileData?.city, 120),
          createdAt: account?.createdAt || null
        };
      });

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
        eventRecords,
        payoutQueue,
        promoterPayoutDetails,
        promoterPublishedEvents,
        venueRecords,
        bookingRequests,
        partnerRoleRecords,
        disputes,
        counts: {
          pendingPromoters: promoterApprovals.filter((item) => normalizeLifecycleStatus(item.status) === "pending").length,
          pendingEvents: pendingEvents.length,
          pendingVenueRequests: bookingRequests.filter((item) => normalizeLifecycleStatus(item.status) === "pending").length
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/notifications/logs", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(200, Math.floor(toFiniteNumber(req.query?.limit, 50))));
      const status = normalizeLifecycleStatus(req.query?.status);
      const category = normalizeText(req.query?.category);
      const recipientEmail = normalizeEmail(req.query?.recipientEmail);
      const filter = {};
      if (["pending", "sent", "failed", "skipped"].includes(status)) {
        filter.status = status;
      }
      if (category) {
        filter.category = category;
      }
      if (isValidEmail(recipientEmail)) {
        filter.recipientEmail = recipientEmail;
      }
      const logs = await NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      res.status(200).json({
        ok: true,
        count: logs.length,
        logs
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/promoters/:accountId", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const accountId = truncateText(req.params?.accountId, 120);
      if (!accountId) {
        res.status(400).json({ ok: false, error: "Valid accountId is required" });
        return;
      }
      const account = await UserAccount.findOne({ _id: accountId, role: "promoter" });
      if (!account) {
        res.status(404).json({ ok: false, error: "Promoter account not found" });
        return;
      }
      const promoterEmail = normalizeEmail(account.email);
      const promoterEventRows = await PromoterEvent.find({}).lean();
      const ownedEventIds = [...new Set(
        promoterEventRows
          .filter((row) => normalizeEmail(row?.data?.promoterEmail) === promoterEmail)
          .map((row) => truncateText(row?.data?.id || row?.eventId, 120))
          .filter(Boolean)
      )];

      const [accountDelete, profileDelete, payoutDelete, promoterEventsDelete, appEventsDelete] = await Promise.all([
        UserAccount.deleteOne({ _id: account._id }),
        UserProfile.deleteOne({ email: promoterEmail }),
        PromoterPayoutAccount.deleteOne({ email: promoterEmail }),
        ownedEventIds.length ? PromoterEvent.deleteMany({ eventId: { $in: ownedEventIds } }) : Promise.resolve({ deletedCount: 0 }),
        ownedEventIds.length ? AppEvent.deleteMany({ eventId: { $in: ownedEventIds } }) : Promise.resolve({ deletedCount: 0 })
      ]);

      res.status(200).json({
        ok: true,
        accountId: String(account._id),
        promoterEmail,
        removed: {
          account: Number(accountDelete?.deletedCount || 0),
          profile: Number(profileDelete?.deletedCount || 0),
          payoutAccount: Number(payoutDelete?.deletedCount || 0),
          promoterEvents: Number(promoterEventsDelete?.deletedCount || 0),
          publishedEvents: Number(appEventsDelete?.deletedCount || 0)
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
      const previousStatus = resolvePromoterAccountStatus(account);
      account.promoterStatus = desired;
      account.isActive = desired === "approved";
      await account.save();
      const template = promoterStatusUpdateTemplate({
        companyName,
        name: account.name,
        status: desired,
        supportEmail,
        dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html"),
        wasReactivated: previousStatus === "suspended" && desired === "approved"
      });
      const notification = await deliverTemplateWithLogging({
        idempotencyKey: buildNotificationIdempotencyKey(["promoter-status", accountId, desired, account.email]),
        category: "promoter-moderation",
        templateName: "promoterStatusUpdateTemplate",
        contextLabel: "promoter-status-change",
        recipientEmail: account.email,
        template,
        metadata: {
          accountId,
          previousStatus,
          nextStatus: desired,
          source: "admin-promoter-status"
        }
      });
      let welcomeDelivery = { ok: false, skipped: true, reason: "not-applicable" };
      if (desired === "approved" && previousStatus === "pending") {
        const welcomeTemplate = welcomeEmailTemplate({
          companyName,
          name: account.name,
          role: "promoter",
          dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html")
        });
        welcomeDelivery = await deliverTemplateWithLogging({
          idempotencyKey: buildNotificationIdempotencyKey(["welcome", "promoter", accountId]),
          category: "account",
          templateName: "welcomeEmailTemplate",
          contextLabel: "welcome-promoter-approved",
          recipientEmail: account.email,
          template: welcomeTemplate,
          metadata: {
            accountId,
            role: "promoter",
            previousStatus,
            nextStatus: desired,
            source: "admin-promoter-status"
          }
        });
      }
      res.status(200).json({
        ok: true,
        accountId,
        status: promoterAccountStatusLabel(desired),
        notificationSent: Boolean(notification.ok),
        welcomeEmailSent: Boolean(welcomeDelivery.ok)
      });
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
      const currentData = promoterRow?.data && typeof promoterRow.data === "object"
        ? promoterRow.data
        : appRow?.data && typeof appRow.data === "object"
          ? appRow.data
          : {};
      const normalizedEvent = {
        ...currentData,
        id: truncateText(currentData?.id || eventId, 120) || eventId,
        eventId
      };
      if (promoterRow?.data && typeof promoterRow.data === "object") {
        const promoterData = {
          ...promoterRow.data,
          id: truncateText(promoterRow.data?.id || promoterRow.eventId, 120) || promoterRow.eventId,
          status: nextStatus
        };
        await PromoterEvent.updateOne(
          { _id: promoterRow._id },
          { $set: { data: promoterData } }
        );
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
      const promoterEmail = normalizeEmail(normalizedEvent?.promoterEmail);
      let moderationNotification = { ok: false, skipped: true, reason: "missing-promoter-email" };
      let publishedNotification = { ok: false, skipped: true, reason: "not-live-status" };
      if (isValidEmail(promoterEmail)) {
        const promoterAccount = await UserAccount.findOne({ email: promoterEmail, role: "promoter" }).lean();
        const promoterName = truncateText(promoterAccount?.name || normalizedEvent?.promoterName, 200) || "Promoter";
        const shareLink = resolveEventShareLink(req, normalizedEvent);
        moderationNotification = await deliverEventModerationNotification(req, {
          promoterEmail,
          promoterName,
          event: {
            ...normalizedEvent,
            status: nextStatus
          },
          status: nextStatus,
          shareLink,
          source: "admin-event-status"
        });
        if (nextStatus === "Live") {
          publishedNotification = await deliverPromoterEventPublishedNotification(req, {
            promoterEmail,
            event: {
              ...normalizedEvent,
              status: "Live"
            },
            shareLink,
            source: "admin-event-status"
          });
        }
      }

      res.status(200).json({
        ok: true,
        eventId,
        status: nextStatus,
        moderationEmailSent: Boolean(moderationNotification.ok),
        publicationEmailSent: Boolean(publishedNotification.ok)
      });
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
      const order = row.data;
      const promoterEmail = normalizeEmail(order?.promoterEmail);
      let payoutNotification = { ok: false, skipped: true, reason: "missing-promoter-email" };
      if (isValidEmail(promoterEmail)) {
        const preferences = await getPromoterNotificationPreferences(promoterEmail);
        if (preferences.notifyPayouts) {
          const promoterAccount = await UserAccount.findOne({ email: promoterEmail, role: "promoter" }).lean();
          const template = payoutProcessedTemplate({
            companyName,
            promoterName: truncateText(promoterAccount?.name, 200) || "Promoter",
            order,
            supportEmail,
            dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html")
          });
          payoutNotification = await deliverTemplateWithLogging({
            idempotencyKey: buildNotificationIdempotencyKey(["payout-processed", orderId, promoterEmail]),
            category: "payout",
            templateName: "payoutProcessedTemplate",
            contextLabel: "payout-processed",
            recipientEmail: promoterEmail,
            template,
            metadata: {
              orderId,
              promoterEmail,
              source: "admin-payout-process"
            }
          });
        } else {
          payoutNotification = { ok: false, skipped: true, reason: "promoter-notify-payouts-disabled" };
        }
      }
      res.status(200).json({ ok: true, order, payoutEmailSent: Boolean(payoutNotification.ok) });
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
      const originalAttendeeEmail = normalizeEmail(order?.attendee?.email);
      const originalAttendeeName = truncateText(order?.attendee?.name, 200);
      const isTransfer = normalizeLifecycleStatus(order?.status).includes("transfer")
        || normalizeLifecycleStatus(order?.dispute?.type).includes("transfer");
      let transferRecipientEmail = "";
      if (resolution === "approved") {
        if (isTransfer) {
          const nextRecipient = recipientEmail || normalizeEmail(order?.transferRequest?.recipientEmail);
          if (!isValidEmail(nextRecipient)) {
            res.status(400).json({ ok: false, error: "Valid recipientEmail is required to approve transfer requests" });
            return;
          }
          transferRecipientEmail = nextRecipient;
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

      const stage = resolution === "approved"
        ? isTransfer ? "transfer-completed" : "refund-approved"
        : isTransfer ? "transfer-rejected" : "refund-rejected";
      const notificationResults = [];
      if (isValidEmail(originalAttendeeEmail)) {
        notificationResults.push(await deliverOrderLifecycleNotification(req, {
          order,
          stage,
          recipientEmail: originalAttendeeEmail,
          recipientName: originalAttendeeName,
          source: "admin-dispute-resolution",
          metadata: {
            orderId,
            resolution,
            recipientEmail: transferRecipientEmail
          }
        }));
      }
      if (
        isTransfer
        && stage === "transfer-completed"
        && isValidEmail(transferRecipientEmail)
        && transferRecipientEmail !== originalAttendeeEmail
      ) {
        notificationResults.push(await deliverOrderLifecycleNotification(req, {
          order,
          stage,
          recipientEmail: transferRecipientEmail,
          source: "admin-dispute-resolution",
          metadata: {
            orderId,
            resolution,
            recipientEmail: transferRecipientEmail
          }
        }));
      }
      res.status(200).json({
        ok: true,
        order,
        lifecycleEmailsSent: notificationResults.filter((item) => item?.ok).length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/ops/approve-all", requireAuth, requireRoles("admin"), async (req, res, next) => {
    try {
      const promoterApprovalFilter = {
        role: "promoter",
        $or: [
          { isActive: false },
          { promoterStatus: { $ne: "approved" } },
          { promoterStatus: { $exists: false } }
        ]
      };
      const [promotersToApprove, promoterDirectory] = await Promise.all([
        UserAccount.find(promoterApprovalFilter).lean(),
        UserAccount.find({ role: "promoter" }).select("email name promoterStatus isActive").lean()
      ]);
      const promoterNameByEmail = new Map(
        promoterDirectory.map((item) => [normalizeEmail(item?.email), truncateText(item?.name, 200) || "Promoter"])
      );
      const promoterResult = await UserAccount.updateMany(
        promoterApprovalFilter,
        { $set: { isActive: true, promoterStatus: "approved" } }
      );
      let promoterEmailsSent = 0;
      let promoterWelcomeEmailsSent = 0;
      for (const promoter of promotersToApprove) {
        const previousStatus = resolvePromoterAccountStatus(promoter);
        const template = promoterStatusUpdateTemplate({
          companyName,
          name: promoter?.name,
          status: "approved",
          supportEmail,
          dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html"),
          wasReactivated: previousStatus === "suspended"
        });
        const delivery = await deliverTemplateWithLogging({
          idempotencyKey: buildNotificationIdempotencyKey(["promoter-status", promoter?._id, "approved", promoter?.email]),
          category: "promoter-moderation",
          templateName: "promoterStatusUpdateTemplate",
          contextLabel: "promoter-status-change",
          recipientEmail: normalizeEmail(promoter?.email),
          template,
          metadata: {
            accountId: String(promoter?._id || ""),
            previousStatus,
            nextStatus: "approved",
            source: "admin-approve-all"
          }
        });
        if (delivery?.ok) promoterEmailsSent += 1;
        if (previousStatus === "pending") {
          const welcomeTemplate = welcomeEmailTemplate({
            companyName,
            name: promoter?.name,
            role: "promoter",
            dashboardUrl: absoluteUrlForPath(req, "/promoter-dashboard.html")
          });
          const welcomeDelivery = await deliverTemplateWithLogging({
            idempotencyKey: buildNotificationIdempotencyKey(["welcome", "promoter", promoter?._id]),
            category: "account",
            templateName: "welcomeEmailTemplate",
            contextLabel: "welcome-promoter-approved",
            recipientEmail: normalizeEmail(promoter?.email),
            template: welcomeTemplate,
            metadata: {
              accountId: String(promoter?._id || ""),
              role: "promoter",
              previousStatus,
              nextStatus: "approved",
              source: "admin-approve-all"
            }
          });
          if (welcomeDelivery?.ok) promoterWelcomeEmailsSent += 1;
        }
      }

      const eventRows = await PromoterEvent.find({}).lean();
      let eventsUpdated = 0;
      let eventModerationEmailsSent = 0;
      let eventPublicationEmailsSent = 0;
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
          const promoterEmail = normalizeEmail(liveData?.promoterEmail);
          if (isValidEmail(promoterEmail)) {
            const promoterName = promoterNameByEmail.get(promoterEmail) || "Promoter";
            const shareLink = resolveEventShareLink(req, liveData);
            const moderationDelivery = await deliverEventModerationNotification(req, {
              promoterEmail,
              promoterName,
              event: liveData,
              status: "Live",
              shareLink,
              source: "admin-approve-all"
            });
            if (moderationDelivery?.ok) eventModerationEmailsSent += 1;
            const publishedDelivery = await deliverPromoterEventPublishedNotification(req, {
              promoterEmail,
              event: liveData,
              shareLink,
              source: "admin-approve-all"
            });
            if (publishedDelivery?.ok) eventPublicationEmailsSent += 1;
          }
        }
      }

      res.status(200).json({
        ok: true,
        promotersApproved: Number(promoterResult.modifiedCount || 0),
        eventsApproved: eventsUpdated,
        promoterEmailsSent,
        promoterWelcomeEmailsSent,
        eventModerationEmailsSent,
        eventPublicationEmailsSent
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
