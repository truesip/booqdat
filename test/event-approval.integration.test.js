const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectToMongo } = require("../src/config/db");
const { createApp } = require("../src/app");
const UserAccount = require("../src/models/UserAccount");
const PromoterEvent = require("../src/models/PromoterEvent");

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

async function registerAndLoginPromoter() {
  const email = "promoter@example.com";
  const password = "Password123!";
  const registerResponse = await request(app).post("/api/auth/register").send({
    name: "Promoter Test",
    email,
    password,
    role: "promoter",
    country: "United States"
  });
  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.ok, true);
  assert.equal(registerResponse.body.requiresApproval, true);
  assert.equal(registerResponse.body.accessToken, undefined);
  assert.equal(registerResponse.body.refreshToken, undefined);

  await UserAccount.updateOne(
    { email },
    { $set: { promoterStatus: "approved", isActive: true } }
  );

  const loginResponse = await request(app).post("/api/auth/login").send({
    email,
    password
  });
  assert.equal(loginResponse.status, 200);
  return {
    email,
    accessToken: loginResponse.body.accessToken
  };
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

test("promoter sync of new event with live status is forced to pending approval and not published", async () => {
  const { email, accessToken } = await registerAndLoginPromoter();

  const syncResponse = await request(app)
    .put("/api/sync/promoter-events")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      promoterEvents: [
        {
          id: "evt-pending-1",
          title: "Pending Test Event",
          status: "Live",
          promoterEmail: "other-owner@example.com",
          city: "Albuquerque"
        }
      ]
    });
  assert.equal(syncResponse.status, 200);
  assert.equal(syncResponse.body.ok, true);
  assert.equal(syncResponse.body.synced, 1);

  const promoterBootstrap = await request(app)
    .get("/api/bootstrap")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(promoterBootstrap.status, 200);
  const storedPromoterEvent = (promoterBootstrap.body.promoterEvents || []).find((event) => event.id === "evt-pending-1");
  assert.ok(storedPromoterEvent);
  assert.equal(String(storedPromoterEvent.status || ""), "Pending Approval");
  assert.equal(String(storedPromoterEvent.promoterEmail || ""), email);

  const publicBootstrap = await request(app).get("/api/bootstrap");
  assert.equal(publicBootstrap.status, 200);
  const publicEvent = (publicBootstrap.body.events || []).find((event) => event.id === "evt-pending-1");
  assert.equal(publicEvent, undefined);
});


async function createAndLoginAdmin() {
  const email = "admin@example.com";
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 12);
  await UserAccount.create({
    name: "Admin User",
    email,
    role: "admin",
    passwordHash,
    isActive: true
  });
  const loginResponse = await request(app).post("/api/auth/login").send({
    email,
    password
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.ok, true);
  return {
    email,
    accessToken: loginResponse.body.accessToken
  };
}
test("promoter cannot force live publication through sync/events without approved promoter event state", async () => {
  const { accessToken } = await registerAndLoginPromoter();

  const publishAttempt = await request(app)
    .put("/api/sync/events")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      events: [
        {
          id: "evt-bypass-1",
          title: "Bypass Attempt Event",
          status: "Live",
          city: "Albuquerque"
        }
      ]
    });
  assert.equal(publishAttempt.status, 403);
  assert.equal(publishAttempt.body.ok, false);

  const publicBootstrap = await request(app).get("/api/bootstrap");
  assert.equal(publicBootstrap.status, 200);
  const leakedEvent = (publicBootstrap.body.events || []).find((event) => event.id === "evt-bypass-1");
  assert.equal(leakedEvent, undefined);
});

test("admin dashboard surfaces promoter pending events for approval", async () => {
  const { accessToken: promoterToken } = await registerAndLoginPromoter();
  const pendingId = "evt-admin-pending-1";

  const syncResponse = await request(app)
    .put("/api/sync/promoter-events")
    .set("Authorization", `Bearer ${promoterToken}`)
    .send({
      promoterEvents: [
        {
          id: pendingId,
          title: "Admin Pending Visibility Test",
          status: "Pending Approval",
          city: "Albuquerque"
        }
      ]
    });
  assert.equal(syncResponse.status, 200);
  assert.equal(syncResponse.body.ok, true);

  const { accessToken: adminToken } = await createAndLoginAdmin();
  const dashboardResponse = await request(app)
    .get("/api/admin/ops/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.ok, true);
  const pending = dashboardResponse.body.pendingEvents || [];
  const targetEvent = pending.find((event) => String(event?.eventId || "") === pendingId);
  assert.ok(targetEvent);
});

test("admin can approve pending promoter events even when legacy records are missing data.id", async () => {
  const { email: promoterEmail } = await registerAndLoginPromoter();
  const pendingId = "evt-admin-legacy-missing-id-1";
  await PromoterEvent.create({
    eventId: pendingId,
    data: {
      title: "Legacy Pending Event Without Data ID",
      status: "Pending Approval",
      promoterEmail,
      city: "Albuquerque",
      category: "Music"
    }
  });

  const { accessToken: adminToken } = await createAndLoginAdmin();
  const dashboardResponse = await request(app)
    .get("/api/admin/ops/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.ok, true);
  const pending = dashboardResponse.body.pendingEvents || [];
  const targetEvent = pending.find((event) => String(event?.eventId || "") === pendingId);
  assert.ok(targetEvent);

  const approveResponse = await request(app)
    .post(`/api/admin/events/${encodeURIComponent(pendingId)}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "Live" });
  assert.equal(approveResponse.status, 200);
  assert.equal(approveResponse.body.ok, true);
  assert.equal(String(approveResponse.body.status || ""), "Live");

  const postApproveDashboard = await request(app)
    .get("/api/admin/ops/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(postApproveDashboard.status, 200);
  assert.equal(postApproveDashboard.body.ok, true);
  const postApprovePending = postApproveDashboard.body.pendingEvents || [];
  assert.equal(
    postApprovePending.some((event) => String(event?.eventId || "") === pendingId),
    false
  );

  const publicBootstrap = await request(app).get("/api/bootstrap");
  assert.equal(publicBootstrap.status, 200);
  const approvedEvent = (publicBootstrap.body.events || []).find((event) => String(event?.id || "") === pendingId);
  assert.ok(approvedEvent);
});

test("promoter delete endpoint only unpublishes marketplace data and preserves pending promoter records", async () => {
  const { accessToken: promoterToken } = await registerAndLoginPromoter();
  const pendingId = "evt-admin-pending-preserve-1";

  const syncResponse = await request(app)
    .put("/api/sync/promoter-events")
    .set("Authorization", `Bearer ${promoterToken}`)
    .send({
      promoterEvents: [
        {
          id: pendingId,
          title: "Pending Record Preservation Test",
          status: "Pending Approval",
          city: "Albuquerque"
        }
      ]
    });
  assert.equal(syncResponse.status, 200);
  assert.equal(syncResponse.body.ok, true);

  const deleteResponse = await request(app)
    .delete(`/api/events/${encodeURIComponent(pendingId)}`)
    .set("Authorization", `Bearer ${promoterToken}`);
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.ok, true);
  assert.equal(deleteResponse.body.scope, "marketplace");
  assert.equal(deleteResponse.body.removedPromoter, 0);

  const promoterBootstrap = await request(app)
    .get("/api/bootstrap")
    .set("Authorization", `Bearer ${promoterToken}`);
  assert.equal(promoterBootstrap.status, 200);
  const promoterEvent = (promoterBootstrap.body.promoterEvents || []).find((event) => event.id === pendingId);
  assert.ok(promoterEvent);

  const { accessToken: adminToken } = await createAndLoginAdmin();
  const dashboardResponse = await request(app)
    .get("/api/admin/ops/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.ok, true);
  const pending = dashboardResponse.body.pendingEvents || [];
  const targetEvent = pending.find((event) => String(event?.eventId || "") === pendingId);
  assert.ok(targetEvent);
});
