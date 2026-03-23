(function initializeBooqdatAuthRuntime() {
  const STORAGE_KEYS = {
    promoter: "booqdat_promoter",
    authSession: "booqdat_auth_session"
  };

  const API_BASE = `${window.location.origin}/api`;
  const ROLE_GUARDS_BY_PAGE = {
    "admin.html": ["admin"],
    "admin-promoters.html": ["admin"],
    "admin-attendees.html": ["admin"],
    "admin-events.html": ["admin"],
    "admin-tickets-sales.html": ["admin"],
    "admin-payments.html": ["admin"],
    "admin-reports.html": ["admin"],
    "admin-disputes.html": ["admin"],
    "admin-settings.html": ["admin"],
    "admin-promoter-profile.html": ["admin"],
    "promoter-dashboard.html": ["promoter", "admin"],
    "promoter-events.html": ["promoter", "admin"],
    "promoter-create.html": ["promoter", "admin"],
    "promoter-analytics.html": ["promoter", "admin"],
    "promoter-payouts.html": ["promoter", "admin"],
    "promoter-settings.html": ["promoter", "admin"],
    "promoter-support.html": ["promoter", "admin"],
    "admin-venues.html": ["admin"],
    "admin-booking-requests.html": ["admin"],
    "admin-partners.html": ["admin"],
    "venue-dashboard.html": ["venue", "admin"],
    "venue-profile.html": ["venue", "admin"],
    "venue-calendar.html": ["venue", "admin"],
    "venue-booking-requests.html": ["venue", "admin"],
    "venue-bookings-history.html": ["venue", "admin"],
    "venue-earnings.html": ["venue", "admin"],
    "venue-settings.html": ["venue", "admin"],
    "host-dashboard.html": ["event_host", "admin"],
    "host-events.html": ["event_host", "admin"],
    "host-venue-search.html": ["event_host", "admin"],
    "host-calendar.html": ["event_host", "admin"],
    "host-budget-sponsors.html": ["event_host", "admin"],
    "host-reports.html": ["event_host", "admin"],
    "artiste-dashboard.html": ["artiste", "admin"],
    "artiste-profile.html": ["artiste", "admin"],
    "artiste-gigs.html": ["artiste", "admin"],
    "artiste-venue-search.html": ["artiste", "admin"],
    "artiste-calendar.html": ["artiste", "admin"],
    "artiste-earnings.html": ["artiste", "admin"],
    "artiste-fan-list.html": ["artiste", "admin"],
    "sponsor-dashboard.html": ["sponsor", "admin"],
    "sponsor-sponsorships.html": ["sponsor", "admin"],
    "sponsor-event-discovery.html": ["sponsor", "admin"],
    "sponsor-proposals.html": ["sponsor", "admin"],
    "sponsor-analytics.html": ["sponsor", "admin"],
    "influencer-dashboard.html": ["influencer", "admin"],
    "influencer-profile.html": ["influencer", "admin"],
    "influencer-invites.html": ["influencer", "admin"],
    "influencer-promo-codes.html": ["influencer", "admin"],
    "influencer-reports.html": ["influencer", "admin"]
  };
  const syncTimers = {};
  let refreshRequestPromise = null;

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

  function getRequiredRolesForCurrentPage() {
    return ROLE_GUARDS_BY_PAGE[currentPageName()] || [];
  }

  function sanitizeRedirectPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.includes("://") || raw.startsWith("//") || raw.startsWith("\\")) return "";
    return raw.startsWith("/") ? raw.slice(1) : raw;
  }

  function redirectToLogin(requiredRoles = [], redirectPath = currentPageName()) {
    const params = new URLSearchParams();
    const safeRedirect = sanitizeRedirectPath(redirectPath);
    if (safeRedirect && safeRedirect !== "login.html") params.set("redirect", safeRedirect);
    const roleHint = normalizeRole(requiredRoles[0]);
    if (roleHint) params.set("role", roleHint);
    window.location.href = params.toString() ? `login.html?${params}` : "login.html";
  }

  function readAuthSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.authSession);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const token = String(parsed.token || "").trim();
      const refreshToken = String(parsed.refreshToken || "").trim();
      const user = parsed.user && typeof parsed.user === "object" ? parsed.user : null;
      if (!token || !refreshToken || !user) return null;
      return { token, refreshToken, user };
    } catch {
      return null;
    }
  }

  function writeAuthSession(session) {
    if (!session || !session.token || !session.refreshToken || !session.user) return;
    localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify({
      token: String(session.token),
      refreshToken: String(session.refreshToken),
      user: session.user
    }));
  }

  function clearAuthSession() {
    localStorage.removeItem(STORAGE_KEYS.authSession);
  }

  function getAuthToken() {
    return readAuthSession()?.token || "";
  }

  function getRefreshToken() {
    return readAuthSession()?.refreshToken || "";
  }

  function hasAnyRole(user, roles) {
    const role = normalizeRole(user?.role);
    return roles.some((candidate) => normalizeRole(candidate) === role);
  }

  function canUseApi() {
    return typeof window !== "undefined" && window.location.protocol.startsWith("http");
  }

  function extractAuthTokens(payload, fallbackRefreshToken = "") {
    const accessToken = String(payload?.accessToken || payload?.token || "").trim();
    const refreshToken = String(payload?.refreshToken || fallbackRefreshToken || "").trim();
    return { accessToken, refreshToken };
  }

  async function refreshAuthSession() {
    if (!canUseApi()) return null;
    const existing = readAuthSession();
    if (!existing?.refreshToken) return null;

    if (refreshRequestPromise) return refreshRequestPromise;
    refreshRequestPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: existing.refreshToken })
        });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : null;

        if (!response.ok || !payload?.ok) {
          if ([400, 401, 403].includes(response.status)) clearAuthSession();
          return null;
        }

        const tokens = extractAuthTokens(payload);
        const nextUser = payload.user && typeof payload.user === "object" ? payload.user : existing.user;
        if (!tokens.accessToken || !tokens.refreshToken || !nextUser) {
          clearAuthSession();
          return null;
        }

        const nextSession = {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: nextUser
        };
        writeAuthSession(nextSession);
        return nextSession;
      } catch {
        return null;
      } finally {
        refreshRequestPromise = null;
      }
    })();

    return refreshRequestPromise;
  }

  async function logoutCurrentSession() {
    const session = readAuthSession();
    if (!session) {
      clearAuthSession();
      return;
    }

    if (canUseApi()) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify({ refreshToken: session.refreshToken })
        });
      } catch {
        // ignore logout transport failures and clear local auth regardless
      }
    }
    clearAuthSession();
  }

  async function apiRequest(path, options = {}) {
    if (!canUseApi()) return null;
    try {
      const token = options.skipAuth ? "" : getAuthToken();
      const method = String(options.method || "GET").toUpperCase();
      let requestUrl = `${API_BASE}${path}`;
      if (method === "GET" && !options.skipCacheBust) {
        const sep = requestUrl.includes("?") ? "&" : "?";
        requestUrl = `${requestUrl}${sep}_=${Date.now()}`;
      }
      const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, max-age=0",
        Pragma: "no-cache",
        ...(options.headers || {})
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(requestUrl, {
        method,
        cache: "no-store",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        const isAuthError = response.status === 401 || response.status === 403;
        if (isAuthError && !options.skipAuth && !options.skipAuthRefresh) {
          const refreshed = await refreshAuthSession();
          if (refreshed?.token) {
            return apiRequest(path, {
              ...options,
              skipAuthRefresh: true,
              suppressAuthRedirect: true
            });
          }
        }
        if (isAuthError && !options.suppressAuthRedirect && currentPageName() !== "login.html") {
          clearAuthSession();
          redirectToLogin(getRequiredRolesForCurrentPage(), currentPageName());
        }
        if (options.includeErrorResponse) {
          return payload || { ok: false, error: `Request failed (${response.status})`, gatewayStatus: response.status };
        }
        return null;
      }

      if (!payload || typeof payload !== "object") {
        return { ok: true };
      }
      return payload;
    } catch {
      return null;
    }
  }

  function queueApiSync(key, path, payload, delayMs = 450) {
    if (!canUseApi()) return;
    clearTimeout(syncTimers[key]);
    syncTimers[key] = setTimeout(() => {
      apiRequest(path, { method: "PUT", body: payload, suppressAuthRedirect: true });
    }, delayMs);
  }

  window.BOOQDATAuthRuntime = {
    normalizeRole,
    normalizeEmail,
    currentPageName,
    getRequiredRolesForCurrentPage,
    sanitizeRedirectPath,
    redirectToLogin,
    readAuthSession,
    writeAuthSession,
    clearAuthSession,
    getAuthToken,
    getRefreshToken,
    hasAnyRole,
    canUseApi,
    extractAuthTokens,
    refreshAuthSession,
    logoutCurrentSession,
    apiRequest,
    queueApiSync
  };
})();
