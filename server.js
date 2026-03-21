const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { loadEnvironment } = require("./src/config/env");
const { connectToMongo } = require("./src/config/db");
const { seedPlatformAccounts } = require("./src/services/accountBootstrap");
const createApiRouter = require("./src/routes/api");

const env = loadEnvironment();
const app = express();
const rootDir = path.resolve(__dirname);

app.disable("x-powered-by");
app.set("trust proxy", env.nodeEnv === "production" ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: env.requestBodyLimit || "12mb" }));
app.use(express.urlencoded({ extended: false, limit: env.requestBodyLimit || "12mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
const authLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.nodeEnv === "production" ? 12 : 250,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({ ok: false, error: "Too many login attempts. Try again in a few minutes." });
  }
});
app.use("/api/auth/login", authLoginLimiter);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.nodeEnv === "production" ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const corsOrigin = env.corsOrigin === "*" ? true : env.corsOrigin;
app.use(cors({ origin: corsOrigin, credentials: false }));

app.use((req, res, next) => {
  const normalizedPath = String(req.path || "").toLowerCase();
  const isSuspiciousPath = normalizedPath.startsWith("/.git")
    || normalizedPath.startsWith("/@fs")
    || normalizedPath.startsWith("/.env")
    || normalizedPath.includes("../")
    || normalizedPath.includes("..\\")
    || normalizedPath.includes("%2e%2e");
  if (isSuspiciousPath) {
    res.status(404).json({ ok: false, error: "Not Found" });
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "booqdat-platform",
    environment: env.nodeEnv
  });
});
app.post("/login.html", (_req, res) => {
  res.redirect(303, "/login.html");
});

app.post("/user-portal.html", (_req, res) => {
  res.redirect(303, "/user-portal.html");
});

app.use("/api", createApiRouter(env));
app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("*", (req, res) => {
  if (
    req.path.startsWith("/api")
    || req.path.startsWith("/.git")
    || req.path.startsWith("/@fs")
    || req.path.startsWith("/.env")
  ) {
    res.status(404).json({ ok: false, error: "Not Found" });
    return;
  }
  res.sendFile(path.join(rootDir, "index.html"));
});

connectToMongo(env.mongoUri)
  .then(async () => {
    await seedPlatformAccounts(env);
    app.listen(env.port, () => {
      console.log(`BOOQDAT server running on port ${env.port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
