const { test, expect } = require("@playwright/test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectToMongo } = require("../../src/config/db");
const { createApp } = require("../../src/app");

function createTestEnv(mongoUri) {
  return {
    mongoUri,
    port: 0,
    nodeEnv: "test",
    corsOrigin: "http://127.0.0.1",
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
let server;
let baseUrl = "";

async function clearDatabase() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function seedUser(apiRequest, email, password) {
  const response = await apiRequest.post(`${baseUrl}/api/auth/register`, {
    data: {
      name: "E2E User",
      email,
      password,
      role: "user"
    }
  });
  expect(response.ok()).toBeTruthy();
}

function collectLocalRequests(page) {
  const requests = [];
  page.on("request", (req) => {
    let parsed;
    try {
      parsed = new URL(req.url());
    } catch {
      return;
    }
    if (parsed.origin !== baseUrl) return;
    requests.push({
      method: req.method(),
      path: parsed.pathname
    });
  });
  return requests;
}

function assertAuthRequestShape(requests) {
  const apiLogins = requests.filter((entry) => entry.method === "POST" && entry.path === "/api/auth/login");
  const nativeFallbackPosts = requests.filter((entry) => entry.method === "POST" && (
    entry.path === "/login.html" || entry.path === "/user-portal.html"
  ));
  expect(apiLogins.length).toBeGreaterThan(0);
  expect(nativeFallbackPosts).toEqual([]);
}

test.beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await connectToMongo(mongoUri);
  const app = createApp(createTestEnv(mongoUri));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
});

test("login page submits credentials to /api/auth/login and never native-posts login routes", async ({ page, request }) => {
  const email = "login-e2e@example.com";
  const password = "Password123!";
  await seedUser(request, email, password);

  const requests = collectLocalRequests(page);
  await page.goto(`${baseUrl}/login.html`);
  await page.locator("#auth-login-form input[name='email']").fill(email);
  await page.locator("#auth-login-form input[name='password']").fill(password);
  await Promise.all([
    page.waitForURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/user-portal\\.html`)),
    page.locator("#auth-login-form button[type='submit']").click()
  ]);

  assertAuthRequestShape(requests);
});

test("user portal auth gate submits credentials to /api/auth/login and never native-posts portal route", async ({ page, request }) => {
  const email = "portal-e2e@example.com";
  const password = "Password123!";
  await seedUser(request, email, password);

  const requests = collectLocalRequests(page);
  await page.goto(`${baseUrl}/user-portal.html`);
  await page.locator("#portal-login-email").fill(email);
  await page.locator("#portal-login-password").fill(password);
  await page.locator("#portal-login-form button[type='submit']").click();
  await expect(page.locator("#portal-main")).toBeVisible();

  assertAuthRequestShape(requests);
});
