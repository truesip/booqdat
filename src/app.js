const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const createApiRouter = require("./routes/api");

const SENSITIVE_QUERY_KEYS = new Set([
  "email",
  "password",
  "token",
  "accesstoken",
  "refreshtoken"
]);

const BLOCKED_STATIC_EXACT_PATHS = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/deployment.txt",
  "/env.txt",
  "/.env"
]);

const BLOCKED_STATIC_PREFIXES = [
  "/src/",
  "/test/",
  "/scripts/",
  "/node_modules/"
];

function normalizePath(value) {
  return String(value || "").toLowerCase();
}

function sanitizeUrlForLogs(urlValue) {
  const raw = String(urlValue || "");
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "http://localhost");
    const keys = [...parsed.searchParams.keys()];
    keys.forEach((key) => {
      if (!SENSITIVE_QUERY_KEYS.has(String(key || "").toLowerCase())) return;
      parsed.searchParams.set(key, "[REDACTED]");
    });
    const query = parsed.searchParams.toString();
    return `${parsed.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return raw.replace(/([?&])(email|password|token|accessToken|refreshToken)=([^&]*)/gi, "$1$2=[REDACTED]");
  }
}

function createHttpLogger(env) {
  morgan.token("safe-url", (req) => sanitizeUrlForLogs(req.originalUrl || req.url));
  const format = env.nodeEnv === "production"
    ? ":remote-addr - :remote-user [:date[clf]] \":method :safe-url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\""
    : ":method :safe-url :status :res[content-length] - :response-time ms";
  return morgan(format);
}

function shouldBlockStaticRequest(requestPath) {
  if (BLOCKED_STATIC_EXACT_PATHS.has(requestPath)) return true;
  if (BLOCKED_STATIC_PREFIXES.some((prefix) => requestPath.startsWith(prefix))) return true;
  if (requestPath.endsWith(".js") && !requestPath.startsWith("/assets/")) return true;
  if (requestPath.endsWith(".json") || requestPath.endsWith(".map")) return true;
  return false;
}

function buildHelmetConfig() {
  return {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  };
}

function createAuthFormFallbackResponse(pathname) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authentication Refresh Required</title>
</head>
<body>
  <main style="font-family: Inter, Arial, sans-serif; max-width: 620px; margin: 2.5rem auto; line-height: 1.5;">
    <h1>Refresh required</h1>
    <p>Your session page needs a fresh client script before sign-in can continue.</p>
    <p><a href="${pathname}">Reload this page and sign in again</a>.</p>
  </main>
</body>
</html>`;
}

function createApp(env) {
  const app = express();
  const rootDir = path.resolve(__dirname, "..");
  const isWildcardCors = env.corsOrigin === "*"
    || (Array.isArray(env.corsOrigin) && env.corsOrigin.includes("*"));
  if (env.nodeEnv === "production" && isWildcardCors) {
    throw new Error("Refusing to start: wildcard CORS is not allowed in production.");
  }

  app.disable("x-powered-by");
  app.set("trust proxy", env.nodeEnv === "production" ? 1 : false);
  app.use(helmet(buildHelmetConfig()));
  app.use(compression());
  app.use(express.json({ limit: env.requestBodyLimit || "12mb" }));
  app.use(express.urlencoded({ extended: false, limit: env.requestBodyLimit || "12mb" }));
  app.use(createHttpLogger(env));

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
    const normalizedPath = normalizePath(req.path);
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
    res.status(405).type("html").send(createAuthFormFallbackResponse("/login.html"));
  });
  app.post("/user-portal.html", (_req, res) => {
    res.status(405).type("html").send(createAuthFormFallbackResponse("/user-portal.html"));
  });

  app.use("/api", createApiRouter(env));

  app.use((req, res, next) => {
    const requestPath = normalizePath(req.path);
    if (!requestPath.startsWith("/api") && shouldBlockStaticRequest(requestPath)) {
      res.status(404).json({ ok: false, error: "Not Found" });
      return;
    }
    next();
  });

  app.use((req, res, next) => {
    const requestPath = normalizePath(req.path);
    const shouldDisableCaching = req.method === "GET"
      && (requestPath.endsWith(".html")
        || requestPath === "/"
        || requestPath === "/assets/app.js"
        || requestPath === "/assets/auth-runtime.js"
        || requestPath === "/assets/auth-guard.js");
    if (shouldDisableCaching) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
    next();
  });

  app.use(express.static(rootDir, { extensions: ["html"], dotfiles: "deny" }));

  app.get("*", (req, res) => {
    const requestPath = normalizePath(req.path);
    if (
      requestPath.startsWith("/api")
      || requestPath.startsWith("/.git")
      || requestPath.startsWith("/@fs")
      || requestPath.startsWith("/.env")
    ) {
      res.status(404).json({ ok: false, error: "Not Found" });
      return;
    }
    res.sendFile(path.join(rootDir, "index.html"));
  });

  return app;
}

module.exports = { createApp };
