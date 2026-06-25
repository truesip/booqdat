const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectToMongo } = require("../src/config/db");
const { createApp } = require("../src/app");

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

async function registerUser(overrides = {}) {
  const payload = {
    name: "Test User",
    email: "user@example.com",
    password: "Password123!",
    role: "user",
    ...overrides
  };
  if (payload.role === "promoter" && !payload.country) {
    payload.country = "United States";
  }
  return request(app).post("/api/auth/register").send(payload);
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

test("register issues access and refresh tokens", async () => {
  const response = await registerUser();
  assert.equal(response.status, 201);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.accessToken);
  assert.ok(response.body.refreshToken);
  assert.equal(response.body.user.email, "user@example.com");
  assert.equal(response.body.user.role, "user");
});

test("promoter registration requires approval and pending promoters cannot log in", async () => {
  const email = "pending-promoter@example.com";
  const password = "Password123!";
  const registerResponse = await registerUser({
    name: "Pending Promoter",
    email,
    password,
    role: "promoter"
  });
  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.ok, true);
  assert.equal(registerResponse.body.requiresApproval, true);
  assert.equal(registerResponse.body.approvalStatus, "Pending");
  assert.equal(registerResponse.body.accessToken, undefined);
  assert.equal(registerResponse.body.refreshToken, undefined);

  const loginResponse = await request(app).post("/api/auth/login").send({
    email,
    password
  });
  assert.equal(loginResponse.status, 403);
  assert.equal(loginResponse.body.ok, false);
  assert.equal(loginResponse.body.errorCode, "PROMOTER_PENDING_APPROVAL");
});

test("login rejects invalid credentials with stable error code", async () => {
  await registerUser();
  const response = await request(app).post("/api/auth/login").send({
    email: "user@example.com",
    password: "WrongPassword123!"
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.errorCode, "INVALID_CREDENTIALS");
});

test("login returns tokens and auth/me returns current user", async () => {
  await registerUser();
  const loginResponse = await request(app).post("/api/auth/login").send({
    email: "user@example.com",
    password: "Password123!"
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.ok, true);
  assert.ok(loginResponse.body.accessToken);
  assert.ok(loginResponse.body.refreshToken);

  const meResponse = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.ok, true);
  assert.equal(meResponse.body.user.email, "user@example.com");
  assert.equal(meResponse.body.user.role, "user");
});

test("refresh rotates refresh tokens and rejects reuse of old token", async () => {
  await registerUser();
  const loginResponse = await request(app).post("/api/auth/login").send({
    email: "user@example.com",
    password: "Password123!"
  });
  assert.equal(loginResponse.status, 200);
  const initialRefreshToken = loginResponse.body.refreshToken;
  assert.ok(initialRefreshToken);

  const firstRefreshResponse = await request(app).post("/api/auth/refresh").send({
    refreshToken: initialRefreshToken
  });
  assert.equal(firstRefreshResponse.status, 200);
  assert.equal(firstRefreshResponse.body.ok, true);
  assert.ok(firstRefreshResponse.body.refreshToken);
  assert.notEqual(firstRefreshResponse.body.refreshToken, initialRefreshToken);

  const replayResponse = await request(app).post("/api/auth/refresh").send({
    refreshToken: initialRefreshToken
  });
  assert.equal(replayResponse.status, 401);
  assert.equal(replayResponse.body.ok, false);
});

test("direct POST to auth pages is rejected with 405 fallback response", async () => {
  const response = await request(app).post("/login.html").type("form").send({
    email: "user@example.com",
    password: "Password123!"
  });
  assert.equal(response.status, 405);
  assert.match(String(response.text || ""), /Refresh required/i);
});
