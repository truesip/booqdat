const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectToMongo } = require("../src/config/db");
const { createApp } = require("../src/app");
const UserAccount = require("../src/models/UserAccount");
const UserProfile = require("../src/models/UserProfile");
const OrderRecord = require("../src/models/OrderRecord");
const NotificationLog = require("../src/models/NotificationLog");

function createTestEnv(mongoUri) {
  return {
    mongoUri,
    port: 0,
    nodeEnv: "test",
    corsOrigin: "*",
    requestBodyLimit: "2mb",
    jwtSecret: "test-jwt-secret",
    jwtExpiresIn: "15m",
    refreshTokenSecret: "test-refresh-secret",
    refreshTokenExpiresIn: "1d",
    seedAdminEmail: "",
    seedAdminPassword: "",
    smtp2goApiBaseUrl: "https://api.smtp2go.com/v3",
    smtp2goApiKey: "",
    mailFrom: "no-reply@booqdat.test",
    mailFromName: "BOOQDAT Test",
    mailReplyTo: "",
    supportEmail: "support@booqdat.test",
    companyName: "BOOQDAT",
    nyvapayBaseUrl: "https://nyvapay.com",
    nyvapayMerchantEmail: "",
    nyvapayApiKey: "",
    nyvapayWebhookUrl: "",
    nyvapaySuccessRedirectUrl: "",
    nyvapayWebhookToken: "",
    nyvapayTimeoutMs: 5000,
    nyvapayMaxAttempts: 1
  };
}

let mongoServer;
let app;

async function clearDatabase() {
  const collectionNames = Object.keys(mongoose.connection.collections);
  await Promise.all(collectionNames.map((name) => mongoose.connection.collections[name].deleteMany({})));
}

async function createAccount({
  name,
  email,
  role,
  password = "Password123!",
  isActive = true,
  promoterStatus = "approved"
}) {
  const passwordHash = await bcrypt.hash(password, 12);
  const account = await UserAccount.create({
    name,
    email,
    role,
    passwordHash,
    isActive,
    promoterStatus: role === "promoter" ? promoterStatus : "approved"
  });
  return { account, password };
}

async function loginAndGetAccessToken(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.accessToken);
  return response.body.accessToken;
}

function futureDate(daysAhead = 10) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await connectToMongo(mongoUri);
  app = createApp(createTestEnv(mongoUri));
});

test.beforeEach(async () => {
  await clearDatabase();
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
});

test("ticket confirmation notification endpoint requires auth and admin/promoter roles", async () => {
  const unauthenticated = await request(app).post("/api/notifications/ticket-confirmation").send({
    order: {
      id: "ord-no-auth",
      attendee: { email: "attendee@example.com" }
    }
  });
  assert.equal(unauthenticated.status, 401);

  const { password } = await createAccount({
    name: "Regular User",
    email: "user@example.com",
    role: "user"
  });
  const userToken = await loginAndGetAccessToken("user@example.com", password);
  const forbidden = await request(app)
    .post("/api/notifications/ticket-confirmation")
    .set("Authorization", `Bearer ${userToken}`)
    .send({
      order: {
        id: "ord-user-role",
        attendee: { email: "attendee@example.com" }
      }
    });
  assert.equal(forbidden.status, 403);
});

test("promoter cannot send ticket confirmation for another promoter account", async () => {
  const { password } = await createAccount({
    name: "Scoped Promoter",
    email: "promoter@example.com",
    role: "promoter"
  });
  const promoterToken = await loginAndGetAccessToken("promoter@example.com", password);
  const response = await request(app)
    .post("/api/notifications/ticket-confirmation")
    .set("Authorization", `Bearer ${promoterToken}`)
    .send({
      promoterEmail: "different-promoter@example.com",
      order: {
        id: "ord-scope-1",
        attendee: { email: "buyer@example.com" },
        eventTitle: "Scoped Event"
      }
    });
  assert.equal(response.status, 403);
});

test("admin ticket confirmation does not default promoter sale alerts to admin email", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);
  const response = await request(app)
    .post("/api/notifications/ticket-confirmation")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      order: {
        id: "ord-admin-ticket-1",
        attendee: { email: "buyer@example.com", name: "Buyer" },
        eventTitle: "Scoped Admin Notification Event"
      }
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.promoterEmail, null);

  const promoterLogs = await NotificationLog.find({
    category: "promoter-sales",
    "metadata.orderId": "ord-admin-ticket-1"
  }).lean();
  assert.equal(promoterLogs.length, 0);

  const attendeeLog = await NotificationLog.findOne({
    category: "order-confirmation",
    "metadata.orderId": "ord-admin-ticket-1",
    recipientEmail: "buyer@example.com"
  }).lean();
  assert.ok(attendeeLog);
});

test("syncing new pending promoter events emits admin queue alert logs", async () => {
  const { password } = await createAccount({
    name: "Event Promoter",
    email: "event-promoter@example.com",
    role: "promoter"
  });
  const promoterToken = await loginAndGetAccessToken("event-promoter@example.com", password);

  const syncResponse = await request(app)
    .put("/api/sync/promoter-events")
    .set("Authorization", `Bearer ${promoterToken}`)
    .send({
      promoterEvents: [
        {
          id: "evt-pending-alert-1",
          title: "Pending Alert Event",
          status: "Pending Approval",
          promoterEmail: "event-promoter@example.com"
        }
      ]
    });
  assert.equal(syncResponse.status, 200);
  assert.equal(syncResponse.body.ok, true);

  const logs = await NotificationLog.find({ category: "admin-queue-alert" }).lean();
  assert.equal(logs.length, 1);
  assert.equal(String(logs[0]?.metadata?.queueType || ""), "Promoter Event Review");
  assert.equal(String(logs[0]?.metadata?.entityId || logs[0]?.metadata?.eventId || ""), "evt-pending-alert-1");
  assert.ok(String(logs[0]?.metadata?.adminUrl || "").includes("/admin-events.html"));
});

test("promoter signup queue alerts include admin account recipients", async () => {
  await createAccount({
    name: "Admin Queue Recipient",
    email: "admin-queue@example.com",
    role: "admin"
  });

  const registerResponse = await request(app).post("/api/auth/register").send({
    name: "Needs Approval Promoter",
    email: "needs-approval@example.com",
    password: "Password123!",
    role: "promoter",
    country: "United States"
  });
  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.ok, true);
  assert.equal(registerResponse.body.requiresApproval, true);

  const logs = await NotificationLog.find({
    category: "admin-queue-alert",
    "metadata.queueType": "Promoter Approvals"
  }).lean();
  const recipients = logs.map((item) => String(item?.recipientEmail || "")).sort();
  assert.ok(recipients.includes("admin-queue@example.com"));
});

test("admin promoter status changes create moderation notification logs", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const { account: promoterAccount } = await createAccount({
    name: "Moderated Promoter",
    email: "moderated-promoter@example.com",
    role: "promoter"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);

  const statusResponse = await request(app)
    .post(`/api/admin/promoters/${encodeURIComponent(String(promoterAccount._id))}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "suspended" });
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.body.ok, true);

  const log = await NotificationLog.findOne({
    category: "promoter-moderation",
    recipientEmail: "moderated-promoter@example.com"
  }).lean();
  assert.ok(log);
  assert.equal(String(log?.metadata?.nextStatus || ""), "suspended");
});

test("admin approval of pending promoter creates welcome notification log", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const { account: pendingPromoter } = await createAccount({
    name: "Pending Promoter",
    email: "pending-promoter@example.com",
    role: "promoter",
    isActive: false,
    promoterStatus: "pending"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);

  const statusResponse = await request(app)
    .post(`/api/admin/promoters/${encodeURIComponent(String(pendingPromoter._id))}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "approved" });
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.body.ok, true);

  const welcomeLog = await NotificationLog.findOne({
    category: "account",
    templateName: "welcomeEmailTemplate",
    recipientEmail: "pending-promoter@example.com",
    "metadata.previousStatus": "pending",
    "metadata.nextStatus": "approved"
  }).lean();
  assert.ok(welcomeLog);
});

test("payout processing respects notifyPayouts preference and skips payout notification", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  await createAccount({
    name: "Payout Promoter",
    email: "payout-promoter@example.com",
    role: "promoter"
  });
  await UserProfile.create({
    email: "payout-promoter@example.com",
    data: {
      notifySales: true,
      notifyPayouts: false
    }
  });
  await OrderRecord.create({
    orderId: "ord-payout-1",
    attendeeEmail: "buyer@example.com",
    data: {
      id: "ord-payout-1",
      attendee: { email: "buyer@example.com", name: "Buyer" },
      promoterEmail: "payout-promoter@example.com",
      eventTitle: "Payout Event",
      total: 120,
      status: "Confirmed",
      paymentStatus: "Paid",
      payoutStatus: "Scheduled"
    }
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);

  const payoutResponse = await request(app)
    .post("/api/admin/payouts/ord-payout-1/process")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({});
  assert.equal(payoutResponse.status, 200);
  assert.equal(payoutResponse.body.ok, true);
  assert.equal(Boolean(payoutResponse.body.payoutEmailSent), false);

  const payoutLogs = await NotificationLog.find({ category: "payout" }).lean();
  assert.equal(payoutLogs.length, 0);
});

test("promoter event published endpoint is idempotent and logged once", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  await createAccount({
    name: "Published Promoter",
    email: "published-promoter@example.com",
    role: "promoter"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);
  const payload = {
    promoterEmail: "published-promoter@example.com",
    event: {
      id: "evt-live-1",
      title: "Live Event"
    },
    shareLink: "https://example.test/checkout.html?event=evt-live-1"
  };

  const first = await request(app)
    .post("/api/notifications/promoter-event-published")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);

  const second = await request(app)
    .post("/api/notifications/promoter-event-published")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
  assert.equal(second.status, 200);
  assert.equal(second.body.ok, true);
  assert.equal(Boolean(second.body.deduped), true);

  const logs = await NotificationLog.find({
    category: "event-publication",
    recipientEmail: "published-promoter@example.com"
  }).lean();
  assert.equal(logs.length, 1);
});

test("admin promoter-event-published endpoint requires explicit promoter email scope", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);

  const response = await request(app)
    .post("/api/notifications/promoter-event-published")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      event: {
        id: "evt-live-no-scope-1",
        title: "Missing Scope Event"
      }
    });
  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});

test("refund requests emit admin queue alert logs for admin recipients", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const { password: userPassword } = await createAccount({
    name: "Refund Requestor",
    email: "refund-user@example.com",
    role: "user"
  });
  await OrderRecord.create({
    orderId: "ord-refund-queue-1",
    attendeeEmail: "refund-user@example.com",
    data: {
      id: "ord-refund-queue-1",
      attendee: { email: "refund-user@example.com", name: "Refund User" },
      promoterEmail: "promoter@example.com",
      eventTitle: "Refund Queue Event",
      eventDate: futureDate(15),
      eventTime: "20:00",
      total: 85,
      status: "Confirmed",
      paymentStatus: "Paid"
    }
  });
  const userToken = await loginAndGetAccessToken("refund-user@example.com", userPassword);
  await loginAndGetAccessToken("admin@example.com", adminPassword);

  const response = await request(app)
    .post("/api/orders/ord-refund-queue-1/refund-request")
    .set("Authorization", `Bearer ${userToken}`)
    .send({});
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);

  const logs = await NotificationLog.find({
    category: "admin-queue-alert",
    "metadata.queueType": "Refund Requests",
    "metadata.entityId": "ord-refund-queue-1"
  }).lean();
  const recipients = logs.map((item) => String(item?.recipientEmail || "")).sort();
  assert.ok(recipients.includes("admin@example.com"));
  assert.ok(logs.every((item) => String(item?.metadata?.adminUrl || "").includes("/admin-disputes.html")));
});

test("transfer requests emit admin queue alert logs for admin recipients", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const { password: userPassword } = await createAccount({
    name: "Transfer Requestor",
    email: "transfer-user@example.com",
    role: "user"
  });
  await OrderRecord.create({
    orderId: "ord-transfer-queue-1",
    attendeeEmail: "transfer-user@example.com",
    data: {
      id: "ord-transfer-queue-1",
      attendee: { email: "transfer-user@example.com", name: "Transfer User" },
      promoterEmail: "promoter@example.com",
      eventTitle: "Transfer Queue Event",
      eventDate: futureDate(16),
      eventTime: "21:00",
      total: 95,
      status: "Confirmed",
      paymentStatus: "Paid"
    }
  });
  const userToken = await loginAndGetAccessToken("transfer-user@example.com", userPassword);
  await loginAndGetAccessToken("admin@example.com", adminPassword);

  const response = await request(app)
    .post("/api/orders/ord-transfer-queue-1/transfer-request")
    .set("Authorization", `Bearer ${userToken}`)
    .send({ recipientEmail: "friend@example.com" });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);

  const logs = await NotificationLog.find({
    category: "admin-queue-alert",
    "metadata.queueType": "Transfer Requests",
    "metadata.entityId": "ord-transfer-queue-1"
  }).lean();
  const recipients = logs.map((item) => String(item?.recipientEmail || "")).sort();
  assert.ok(recipients.includes("admin@example.com"));
  assert.ok(logs.every((item) => String(item?.metadata?.adminUrl || "").includes("/admin-disputes.html")));
});

test("dispute transfer approval emits lifecycle notifications for original and recipient attendees", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  await OrderRecord.create({
    orderId: "ord-transfer-dispute-1",
    attendeeEmail: "original-buyer@example.com",
    data: {
      id: "ord-transfer-dispute-1",
      attendee: { email: "original-buyer@example.com", name: "Original Buyer" },
      promoterEmail: "promoter@example.com",
      eventTitle: "Transfer Event",
      eventDate: futureDate(14),
      eventTime: "20:00",
      total: 95,
      status: "Transfer Requested",
      paymentStatus: "Paid",
      transferRequest: {
        recipientEmail: "friend@example.com",
        status: "Pending"
      },
      dispute: {
        type: "transfer",
        status: "Open"
      }
    }
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);

  const resolveResponse = await request(app)
    .post("/api/admin/disputes/ord-transfer-dispute-1/resolve")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ resolution: "approved", recipientEmail: "friend@example.com" });
  assert.equal(resolveResponse.status, 200);
  assert.equal(resolveResponse.body.ok, true);

  const lifecycleLogs = await NotificationLog.find({
    category: "order-lifecycle",
    "metadata.orderId": "ord-transfer-dispute-1",
    "metadata.stage": "transfer-completed"
  }).lean();
  const recipients = lifecycleLogs.map((item) => String(item?.recipientEmail || "")).sort();
  assert.deepEqual(recipients, ["friend@example.com", "original-buyer@example.com"]);
});

test("admin notification logs endpoint is admin-only and returns stored logs", async () => {
  const { password: adminPassword } = await createAccount({
    name: "Admin",
    email: "admin@example.com",
    role: "admin"
  });
  const { password: promoterPassword } = await createAccount({
    name: "Promoter",
    email: "promoter@example.com",
    role: "promoter"
  });
  const adminToken = await loginAndGetAccessToken("admin@example.com", adminPassword);
  const promoterToken = await loginAndGetAccessToken("promoter@example.com", promoterPassword);

  await NotificationLog.create({
    idempotencyKey: "manual-log-1",
    category: "order-lifecycle",
    contextLabel: "test",
    templateName: "orderLifecycleUpdateTemplate",
    recipientEmail: "buyer@example.com",
    status: "sent",
    attempts: 1,
    maxAttempts: 2,
    metadata: { stage: "refund-requested" }
  });

  const forbidden = await request(app)
    .get("/api/admin/notifications/logs")
    .set("Authorization", `Bearer ${promoterToken}`);
  assert.equal(forbidden.status, 403);

  const adminResponse = await request(app)
    .get("/api/admin/notifications/logs?limit=5")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.body.ok, true);
  assert.ok(Array.isArray(adminResponse.body.logs));
  assert.ok(adminResponse.body.logs.length >= 1);
});
