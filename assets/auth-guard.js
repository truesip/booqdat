(function initAuthGuard() {
  const AUTH_STORAGE_KEY = "booqdat_auth_session";
  const API_BASE = `${window.location.origin}/api`;
  const SENSITIVE_QUERY_PARAMS = ["email", "password", "token", "accessToken", "refreshToken"];

  function normalizeRole(value) {
    const role = String(value || "").trim().toLowerCase();
    return ["admin", "promoter", "user", "venue", "event_host", "artiste", "sponsor", "influencer"].includes(role) ? role : "";
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function currentPageName() {
    const segments = window.location.pathname.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1].toLowerCase() : "index.html";
  }

  function sanitizeRedirectPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.includes("://") || raw.startsWith("//") || raw.startsWith("\\")) return "";
    return raw.startsWith("/") ? raw.slice(1) : raw;
  }

  function getPostAuthDestination(role, redirectPath) {
    const safeRedirect = sanitizeRedirectPath(redirectPath);
    if (safeRedirect) return safeRedirect;
    if (role === "admin") return "admin.html";
    if (role === "promoter") return "promoter-dashboard.html";
    if (role === "venue") return "venue-dashboard.html";
    if (role === "event_host") return "host-dashboard.html";
    if (role === "artiste") return "artiste-dashboard.html";
    if (role === "sponsor") return "sponsor-dashboard.html";
    if (role === "influencer") return "influencer-dashboard.html";
    if (role === "user") return "user-portal.html";
    return "index.html";
  }

  function hasAnyRole(user, roles) {
    const userRole = normalizeRole(user?.role);
    return roles.some((candidate) => normalizeRole(candidate) === userRole);
  }

  function extractAuthTokens(payload, fallbackRefreshToken = "") {
    const accessToken = String(payload?.accessToken || payload?.token || "").trim();
    const refreshToken = String(payload?.refreshToken || fallbackRefreshToken || "").trim();
    return { accessToken, refreshToken };
  }

  function writeAuthSession(session) {
    if (!session?.token || !session?.refreshToken || !session?.user) return;
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token: String(session.token),
        refreshToken: String(session.refreshToken),
        user: session.user
      }));
    } catch {
      // best effort only
    }
  }

  function setStatus(target, message, isError) {
    if (!target) return;
    target.textContent = String(message || "");
    target.style.color = isError ? "#b3261e" : "";
  }

  function setPortalFeedback(target, message, isError) {
    if (!target) return;
    target.classList.remove("hidden");
    target.textContent = String(message || "");
    target.style.color = isError ? "#b3261e" : "";
  }

  function removeSensitiveQueryParams() {
    try {
      const url = new URL(window.location.href);
      let didStrip = false;
      SENSITIVE_QUERY_PARAMS.forEach((key) => {
        if (!url.searchParams.has(key)) return;
        url.searchParams.delete(key);
        didStrip = true;
      });
      if (didStrip) {
        const query = url.searchParams.toString();
        const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash || ""}`;
        window.history.replaceState({}, "", nextUrl);
      }
      return url;
    } catch {
      return null;
    }
  }

  async function authRequest(path, body) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, max-age=0",
          Pragma: "no-cache"
        },
        body: JSON.stringify(body || {})
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok) {
        if (payload && typeof payload === "object") return payload;
        return { ok: false, error: `Request failed (${response.status})` };
      }
      if (payload && typeof payload === "object") return payload;
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error. Please retry." };
    }
  }

  function bindAccountAccessForms() {
    const loginForm = document.querySelector("#auth-login-form");
    const registerForm = document.querySelector("#auth-register-form");
    const loginStatus = document.querySelector("#auth-login-status");
    const registerStatus = document.querySelector("#auth-register-status");
    const roleHintLabel = document.querySelector("#auth-role-hint");
    if (!loginForm && !registerForm) return;

    const url = removeSensitiveQueryParams() || new URL(window.location.href);
    const requiredRole = normalizeRole(url.searchParams.get("role"));
    const redirectPath = sanitizeRedirectPath(url.searchParams.get("redirect"));
    const isSignupPage = currentPageName() === "signup.html";
    const preferredSignupRole = ["user", "promoter", "venue", "event_host", "artiste", "sponsor", "influencer"].includes(requiredRole) ? requiredRole : "";

    if (roleHintLabel) {
      if (isSignupPage) {
        roleHintLabel.textContent = preferredSignupRole
          ? `Create a ${preferredSignupRole} account to continue.`
          : "Create an account to access your dashboard.";
      } else {
        roleHintLabel.textContent = requiredRole
          ? `Sign in with a ${requiredRole} account to continue.`
          : "Sign in to access your dashboard.";
      }
    }

    if (loginForm && loginForm.dataset.authGuardBound !== "1") {
      loginForm.dataset.authGuardBound = "1";
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const email = normalizeEmail(formData.get("email"));
        const password = String(formData.get("password") || "");
        if (!email || !password) {
          setStatus(loginStatus, "Email and password are required.", true);
          return;
        }

        setStatus(loginStatus, "");
        const response = await authRequest("/auth/login", { email, password });
        const tokens = extractAuthTokens(response);
        const invalidCredentials = response?.errorCode === "INVALID_CREDENTIALS"
          || String(response?.error || "").toLowerCase().includes("invalid credentials");
        if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
          const fallbackMessage = requiredRole
            ? `Invalid email or password. Use your ${requiredRole} account credentials for this page.`
            : "Invalid email or password. Check your credentials or create an account on Sign Up.";
          setStatus(loginStatus, invalidCredentials ? fallbackMessage : (response?.error || "Unable to sign in with those credentials."), true);
          return;
        }
        if (requiredRole && !hasAnyRole(response.user, [requiredRole])) {
          setStatus(loginStatus, `This account is ${response.user.role}. A ${requiredRole} account is required.`, true);
          return;
        }

        writeAuthSession({
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: response.user
        });
        const destination = getPostAuthDestination(normalizeRole(response.user.role), redirectPath);
        window.location.href = destination;
      });
    }

    if (registerForm && registerForm.dataset.authGuardBound !== "1") {
      registerForm.dataset.authGuardBound = "1";
      if (preferredSignupRole && registerForm.elements?.role) {
        registerForm.elements.role.value = preferredSignupRole;
      }
      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const payload = {
          name: String(formData.get("name") || "").trim(),
          email: normalizeEmail(formData.get("email")),
          password: String(formData.get("password") || ""),
          role: normalizeRole(formData.get("role")),
          country: String(formData.get("country") || "").trim()
        };
        if (!payload.name || !payload.email || !payload.password || !payload.role) {
          setStatus(registerStatus, "Name, email, password, and role are required.", true);
          return;
        }
        if (payload.role === "promoter" && !payload.country) {
          setStatus(registerStatus, "Country is required for promoter registration.", true);
          return;
        }

        setStatus(registerStatus, "");
        const response = await authRequest("/auth/register", payload);
        if (response?.ok && response?.requiresApproval && payload.role === "promoter") {
          setStatus(registerStatus, response?.message || "Promoter account created. An admin must approve your account before you can sign in.");
          return;
        }
        const tokens = extractAuthTokens(response);
        if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
          setStatus(registerStatus, response?.error || "Unable to create account.", true);
          return;
        }
        writeAuthSession({
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: response.user
        });
        const destination = getPostAuthDestination(normalizeRole(response.user.role), redirectPath);
        window.location.href = destination;
      });
    }
  }

  function bindUserPortalLoginForm() {
    const loginForm = document.querySelector("#portal-login-form");
    const emailInput = document.querySelector("#portal-login-email");
    const passwordInput = document.querySelector("#portal-login-password");
    const feedback = document.querySelector("#portal-feedback");
    if (!loginForm || !emailInput || !passwordInput) return;

    if (loginForm.dataset.authGuardBound === "1") return;
    loginForm.dataset.authGuardBound = "1";
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = normalizeEmail(emailInput.value);
      const password = String(passwordInput.value || "");
      if (!email || !password) {
        setPortalFeedback(feedback, "Email and password are required.", true);
        return;
      }

      setPortalFeedback(feedback, "");
      const response = await authRequest("/auth/login", { email, password });
      const tokens = extractAuthTokens(response);
      const invalidCredentials = response?.errorCode === "INVALID_CREDENTIALS"
        || String(response?.error || "").toLowerCase().includes("invalid credentials");
      if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
        setPortalFeedback(
          feedback,
          invalidCredentials
            ? "Invalid email or password. Use your User account credentials to access this portal."
            : (response?.error || "Unable to sign in."),
          true
        );
        return;
      }
      if (!hasAnyRole(response.user, ["user", "admin"])) {
        setPortalFeedback(feedback, "Use a user account to access the portal.", true);
        return;
      }

      writeAuthSession({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: response.user
      });
      window.location.href = "user-portal.html";
    });
  }

  function initialize() {
    bindAccountAccessForms();
    bindUserPortalLoginForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
