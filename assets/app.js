const DEMO_EVENTS = [
  {
    id: "evt-1001",
    title: "Sunset Rooftop Sessions",
    category: "Music",
    venue: "Skyline Roof Lounge",
    city: "Albuquerque",
    state: "NM",
    date: "2026-05-04",
    time: "19:00",
    price: 35,
    capacity: 320,
    description: "Open-air evening set featuring regional DJs and special guests."
  },
  {
    id: "evt-1002",
    title: "Southwest Comedy Night",
    category: "Comedy",
    venue: "Mesa Stage Hall",
    city: "Albuquerque",
    state: "NM",
    date: "2026-05-11",
    time: "20:30",
    price: 28,
    capacity: 220,
    description: "A curated lineup of touring and local comedians."
  },
  {
    id: "evt-1003",
    title: "High Desert Boxing Showcase",
    category: "Sports",
    venue: "Rio Grande Arena",
    city: "Santa Fe",
    state: "NM",
    date: "2026-05-18",
    time: "18:00",
    price: 55,
    capacity: 860,
    description: "Championship-card evening featuring regional contenders."
  },
  {
    id: "evt-1004",
    title: "Creative Founder Meetup",
    category: "Business",
    venue: "Innovate Hub Downtown",
    city: "Phoenix",
    state: "AZ",
    date: "2026-05-21",
    time: "17:30",
    price: 20,
    capacity: 180,
    description: "Networking and panel sessions for creators and founders."
  },
  {
    id: "evt-1005",
    title: "City Food & Culture Fest",
    category: "Community",
    venue: "Old Town Plaza",
    city: "Albuquerque",
    state: "NM",
    date: "2026-05-26",
    time: "13:00",
    price: 15,
    capacity: 1200,
    description: "Family-friendly market with food, arts, and live performances."
  },
  {
    id: "evt-1006",
    title: "Desert Bass Weekender",
    category: "Music",
    venue: "Canyon Yard",
    city: "Las Vegas",
    state: "NV",
    date: "2026-06-06",
    time: "21:00",
    price: 65,
    capacity: 950,
    description: "Two-night electronic experience with national headliners."
  }
];

const STORAGE_KEYS = {
  promoter: "booqdat_promoter",
  customEvents: "booqdat_custom_events",
  promoterDashboardEvents: "booqdat_promoter_dashboard_events",
  buyerOrders: "booqdat_buyer_orders",
  userProfiles: "booqdat_user_profiles",
  userPaymentMethods: "booqdat_user_payment_methods",
  userFavorites: "booqdat_user_favorites",
  userPortalSession: "booqdat_user_portal_session",
  authSession: "booqdat_auth_session"
};

const API_BASE = `${window.location.origin}/api`;
const syncTimers = {};
let refreshRequestPromise = null;
const ROLE_GUARDS_BY_PAGE = {
  "admin.html": ["admin"],
  "promoter-dashboard.html": ["promoter", "admin"],
  "user-portal.html": ["user", "admin"]
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ["admin", "promoter", "user"].includes(role) ? role : "";
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

function getPostAuthDestination(role, redirectPath) {
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  if (safeRedirect) return safeRedirect;
  if (role === "admin") return "admin.html";
  if (role === "promoter") return "promoter-dashboard.html";
  if (role === "user") return "user-portal.html";
  return "index.html";
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

function getPromoterProfileEmail() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.promoter);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return normalizeEmail(parsed?.email);
  } catch {
    return "";
  }
}

function getActivePromoterEmail() {
  const authEmail = normalizeEmail(readAuthSession()?.user?.email);
  if (authEmail) return authEmail;
  return getPromoterProfileEmail();
}

function notifyTicketConfirmation(order, eventDetails = {}) {
  if (!canUseApi() || !order?.attendee?.email) return;
  const promoterEmail = normalizeEmail(eventDetails?.promoterEmail || "");
  apiRequest("/notifications/ticket-confirmation", {
    method: "POST",
    body: {
      order,
      promoterEmail
    },
    skipAuth: true,
    suppressAuthRedirect: true,
    includeErrorResponse: true
  });
}

function notifyPromoterEventPublished(eventDetails, shareLink) {
  if (!canUseApi()) return;
  const promoterEmail = normalizeEmail(eventDetails?.promoterEmail || getActivePromoterEmail());
  if (!promoterEmail) return;
  apiRequest("/notifications/promoter-event-published", {
    method: "POST",
    body: {
      event: eventDetails,
      shareLink,
      promoterEmail
    },
    suppressAuthRedirect: true,
    includeErrorResponse: true
  });
}

async function apiRequest(path, options = {}) {
  if (!canUseApi()) return null;
  try {
    const token = options.skipAuth ? "" : getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
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
        return payload || { ok: false, error: `Request failed (${response.status})` };
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

let didHydrateFromApi = false;
async function hydrateStateFromApi() {
  if (!canUseApi() || didHydrateFromApi) return;
  const data = await apiRequest("/bootstrap");
  if (!data) return;
  const role = normalizeRole(data?.auth?.role);
  const canHydrateUserScope = role === "admin" || role === "user";

  if (Array.isArray(data.events)) localStorage.setItem(STORAGE_KEYS.customEvents, JSON.stringify(data.events));
  if (Array.isArray(data.promoterEvents)) localStorage.setItem(STORAGE_KEYS.promoterDashboardEvents, JSON.stringify(data.promoterEvents));
  if (canHydrateUserScope && Array.isArray(data.orders)) localStorage.setItem(STORAGE_KEYS.buyerOrders, JSON.stringify(data.orders));
  if (canHydrateUserScope && data.userProfiles && typeof data.userProfiles === "object") localStorage.setItem(STORAGE_KEYS.userProfiles, JSON.stringify(data.userProfiles));
  if (canHydrateUserScope && data.userPaymentMethods && typeof data.userPaymentMethods === "object") localStorage.setItem(STORAGE_KEYS.userPaymentMethods, JSON.stringify(data.userPaymentMethods));
  if (canHydrateUserScope && data.userFavorites && typeof data.userFavorites === "object") localStorage.setItem(STORAGE_KEYS.userFavorites, JSON.stringify(data.userFavorites));

  didHydrateFromApi = true;
}

async function enforceRoleGuardForCurrentPage() {
  const requiredRoles = getRequiredRolesForCurrentPage();
  if (!requiredRoles.length) return true;

  const session = readAuthSession();
  if (!session?.token || !hasAnyRole(session.user, requiredRoles)) {
    redirectToLogin(requiredRoles, currentPageName());
    return false;
  }

  const me = await apiRequest("/auth/me", { includeErrorResponse: true, suppressAuthRedirect: true });
  if (!me?.ok || !me.user || !hasAnyRole(me.user, requiredRoles)) {
    clearAuthSession();
    redirectToLogin(requiredRoles, currentPageName());
    return false;
  }

  const latestSession = readAuthSession();
  if (latestSession?.token && latestSession?.refreshToken) {
    writeAuthSession({
      token: latestSession.token,
      refreshToken: latestSession.refreshToken,
      user: me.user
    });
  }
  return true;
}

function readStoredEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customEvents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredEvents(events) {
  localStorage.setItem(STORAGE_KEYS.customEvents, JSON.stringify(events));
  queueApiSync("events", "/sync/events", { events });
}

function upsertStoredEvent(event) {
  const current = readStoredEvents();
  const idx = current.findIndex((item) => item.id === event.id);
  if (idx >= 0) current[idx] = event;
  else current.unshift(event);
  writeStoredEvents(current);
}

function removeStoredEventById(eventId) {
  const next = readStoredEvents().filter((event) => event.id !== eventId);
  writeStoredEvents(next);
  if (canUseApi()) {
    apiRequest(`/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  }
}

function readPromoterDashboardEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.promoterDashboardEvents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePromoterDashboardEvents(events) {
  localStorage.setItem(STORAGE_KEYS.promoterDashboardEvents, JSON.stringify(events));
  queueApiSync("promoter-events", "/sync/promoter-events", { promoterEvents: events });
}

function readBuyerOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.buyerOrders);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuyerOrders(orders) {
  localStorage.setItem(STORAGE_KEYS.buyerOrders, JSON.stringify(orders));
  queueApiSync("orders", "/sync/orders", { orders });
}

function addBuyerOrder(order) {
  const current = readBuyerOrders();
  current.unshift(order);
  writeBuyerOrders(current);
}

function upsertBuyerOrder(order) {
  const current = readBuyerOrders();
  const idx = current.findIndex((item) => item?.id === order?.id);
  if (idx >= 0) current[idx] = order;
  else current.unshift(order);
  writeBuyerOrders(current);
}

function readUserProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userProfiles);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserProfiles(profiles) {
  localStorage.setItem(STORAGE_KEYS.userProfiles, JSON.stringify(profiles));
  queueApiSync("user-profiles", "/sync/user-profiles", { userProfiles: profiles });
}

function readUserPaymentMethods() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userPaymentMethods);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserPaymentMethods(methods) {
  localStorage.setItem(STORAGE_KEYS.userPaymentMethods, JSON.stringify(methods));
  queueApiSync("user-payment-methods", "/sync/user-payment-methods", { userPaymentMethods: methods });
}

function readUserFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userFavorites);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserFavorites(favorites) {
  localStorage.setItem(STORAGE_KEYS.userFavorites, JSON.stringify(favorites));
  queueApiSync("user-favorites", "/sync/user-favorites", { userFavorites: favorites });
}

function readUserPortalSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userPortalSession);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeUserPortalSession(session) {
  localStorage.setItem(STORAGE_KEYS.userPortalSession, JSON.stringify(session));
}

function upsertPromoterDashboardEventFromSimple(event) {
  const current = readPromoterDashboardEvents();
  const idx = current.findIndex((item) => item.id === event.id);
  const ticketQty = Number(event.capacity) || 300;
  const gaPrice = Number(event.price) || 25;
  const sold = Math.min(ticketQty, Math.round(ticketQty * 0.28));
  const mapped = {
    id: event.id,
    title: event.title,
    description: event.description || "",
    category: event.category || "Community",
    tags: [],
    date: event.date,
    time: event.time,
    venueType: "Physical",
    venue: event.venue || "Venue TBA",
    city: event.city || "Albuquerque",
    state: event.state || "NM",
    capacity: ticketQty,
    ticketTypes: [
      {
        name: "General Admission",
        price: gaPrice,
        quantity: ticketQty,
        salesStart: event.date,
        salesEnd: event.date
      }
    ],
    banner: event.banner || "",
    promoCodes: [],
    status: "Live",
    ticketsSold: sold,
    revenue: sold * gaPrice,
    promoterEmail: normalizeEmail(event.promoterEmail || getActivePromoterEmail()),
    createdAt: new Date().toISOString()
  };
  if (idx >= 0) current[idx] = { ...current[idx], ...mapped };
  else current.unshift(mapped);
  writePromoterDashboardEvents(current);
}

function getAllEvents() {
  return [...DEMO_EVENTS, ...readStoredEvents()];
}

function formatDate(inputDate) {
  const date = new Date(inputDate + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(inputTime) {
  const [hour, minute] = String(inputTime || "").split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  const date = new Date();
  date.setHours(hour, minute, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function usd(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function createEventCard(event) {
  return `
    <article class="event-card">
      <div class="event-banner">
        <span class="event-badge">${event.category}</span>
      </div>
      <div class="event-body">
        <h3>${event.title}</h3>
        <div class="event-meta">${formatDate(event.date)} • ${formatTime(event.time)}</div>
        <div class="event-meta">${event.venue}, ${event.city}, ${event.state}</div>
        <div class="event-actions">
          <span class="event-price">From ${usd(event.price)}</span>
          <a href="checkout.html?event=${encodeURIComponent(event.id)}" class="btn btn-primary">Buy Tickets</a>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedEvents() {
  const target = document.querySelector("#featured-events");
  if (!target) return;
  const featured = getAllEvents().slice(0, 6);
  target.innerHTML = featured.map(createEventCard).join("");
}

function renderBrowseEvents() {
  const grid = document.querySelector("#events-grid");
  const searchInput = document.querySelector("#search-input");
  const citySelect = document.querySelector("#city-filter");
  const categorySelect = document.querySelector("#category-filter");
  if (!grid || !searchInput || !citySelect || !categorySelect) return;

  const events = getAllEvents();
  const cities = [...new Set(events.map((event) => event.city))].sort();
  const categories = [...new Set(events.map((event) => event.category))].sort();

  citySelect.innerHTML = `<option value="">All Cities</option>${cities.map((city) => `<option value="${city}">${city}</option>`).join("")}`;
  categorySelect.innerHTML = `<option value="">All Categories</option>${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}`;

  function draw() {
    const query = searchInput.value.trim().toLowerCase();
    const city = citySelect.value;
    const category = categorySelect.value;

    const filtered = events.filter((event) => {
      const textMatch = !query || `${event.title} ${event.venue} ${event.city}`.toLowerCase().includes(query);
      const cityMatch = !city || event.city === city;
      const categoryMatch = !category || event.category === category;
      return textMatch && cityMatch && categoryMatch;
    });

    if (!filtered.length) {
      grid.innerHTML = `<article class="form-card"><h3>No matching events</h3><p>Try another city, category, or search term.</p></article>`;
      return;
    }

    grid.innerHTML = filtered.map(createEventCard).join("");
  }

  [searchInput, citySelect, categorySelect].forEach((el) => el.addEventListener("input", draw));
  draw();
}

function setYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}
function setupAuthPage() {
  const loginForm = document.querySelector("#auth-login-form");
  const registerForm = document.querySelector("#auth-register-form");
  const loginStatus = document.querySelector("#auth-login-status");
  const registerStatus = document.querySelector("#auth-register-status");
  const roleHintLabel = document.querySelector("#auth-role-hint");
  if (!loginForm && !registerForm) return;

  const url = new URL(window.location.href);
  const redirectPath = sanitizeRedirectPath(url.searchParams.get("redirect"));
  const requiredRole = normalizeRole(url.searchParams.get("role"));

  if (roleHintLabel) {
    roleHintLabel.textContent = requiredRole
      ? `Sign in with a ${requiredRole} account to continue.`
      : "Sign in to access your dashboard.";
  }

  function setStatus(target, message, isError = false) {
    if (!target) return;
    target.textContent = message;
    target.style.color = isError ? "#b3261e" : "";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      if (!email || !password) {
        setStatus(loginStatus, "Email and password are required.", true);
        return;
      }

      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      const tokens = extractAuthTokens(response);
      if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
        setStatus(loginStatus, response?.error || "Unable to sign in with those credentials.", true);
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

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim().toLowerCase(),
        password: String(formData.get("password") || ""),
        role: normalizeRole(formData.get("role")),
        adminRegistrationKey: String(formData.get("adminRegistrationKey") || "").trim()
      };

      if (!payload.name || !payload.email || !payload.password || !payload.role) {
        setStatus(registerStatus, "Name, email, password, and role are required.", true);
        return;
      }

      const response = await apiRequest("/auth/register", {
        method: "POST",
        body: payload,
        skipAuth: true,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
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

function setupUserPortal() {
  const root = document.querySelector("#user-portal");
  if (!root) return;

  const authGate = root.querySelector("#portal-auth-gate");
  const portalMain = root.querySelector("#portal-main");
  const loginForm = root.querySelector("#portal-login-form");
  const loginEmailInput = root.querySelector("#portal-login-email");
  const loginPasswordInput = root.querySelector("#portal-login-password");
  const loginNameInput = root.querySelector("#portal-login-name");
  const accountLabel = root.querySelector("#portal-account-label");
  const feedback = root.querySelector("#portal-feedback");
  const upcomingGrid = root.querySelector("#portal-upcoming-tickets");
  const pastGrid = root.querySelector("#portal-past-tickets");
  const historyBody = root.querySelector("#portal-history-body");
  const profileForm = root.querySelector("#portal-profile-form");
  const profileStatus = root.querySelector("#portal-profile-status");
  const paymentForm = root.querySelector("#portal-payment-form");
  const paymentStatus = root.querySelector("#portal-payment-status");
  const paymentList = root.querySelector("#portal-payment-list");
  const savedFavorites = root.querySelector("#portal-saved-favorites");
  const discoverFavorites = root.querySelector("#portal-discover-events");
  const sidebarToggle = root.querySelector("[data-user-sidebar-toggle]");

  let activeEmail = "";
  let activeTab = "tickets";

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function showFeedback(message) {
    if (!feedback) return;
    feedback.classList.remove("hidden");
    feedback.innerHTML = message;
  }

  function clearFeedback() {
    if (!feedback) return;
    feedback.classList.add("hidden");
    feedback.innerHTML = "";
  }

  function allOrders() {
    return readBuyerOrders();
  }

  function saveOrders(nextOrders) {
    writeBuyerOrders(nextOrders);
  }

  function ordersForEmail(email) {
    const normalized = normalizeEmail(email);
    return allOrders()
      .filter((order) => normalizeEmail(order?.attendee?.email) === normalized)
      .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
  }

  function readProfile(email) {
    const profiles = readUserProfiles();
    return profiles[normalizeEmail(email)] || {
      name: "",
      email: normalizeEmail(email),
      phone: "",
      reminders: true,
      promotions: false
    };
  }

  function writeProfile(email, profile) {
    const profiles = readUserProfiles();
    profiles[normalizeEmail(email)] = profile;
    writeUserProfiles(profiles);
  }

  function readMethods(email) {
    const store = readUserPaymentMethods();
    return Array.isArray(store[normalizeEmail(email)]) ? store[normalizeEmail(email)] : [];
  }

  function writeMethods(email, methods) {
    const store = readUserPaymentMethods();
    store[normalizeEmail(email)] = methods;
    writeUserPaymentMethods(store);
  }

  function readFavorites(email) {
    const store = readUserFavorites();
    return Array.isArray(store[normalizeEmail(email)]) ? store[normalizeEmail(email)] : [];
  }

  function writeFavorites(email, favorites) {
    const store = readUserFavorites();
    store[normalizeEmail(email)] = favorites;
    writeUserFavorites(store);
  }

  function ticketDateTime(order) {
    const datePart = order?.eventDate || "";
    const timePart = order?.eventTime || "00:00";
    return new Date(`${datePart}T${timePart}:00`);
  }

  function isUpcoming(order) {
    return ticketDateTime(order) >= new Date();
  }

  function canRefund(order) {
    if (!isUpcoming(order)) return false;
    if (order.status !== "Confirmed") return false;
    const diffMs = ticketDateTime(order).getTime() - Date.now();
    return diffMs >= 48 * 60 * 60 * 1000;
  }

  function orderStatusLabel(order) {
    return order.status || "Confirmed";
  }

  function statusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("refund")) return "pending";
    if (normalized.includes("confirmed")) return "approved";
    return "pending";
  }

  function pseudoQrSvgData(token) {
    const size = 21;
    const cell = 6;
    let rects = "";
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = (x + y * size) % token.length;
        const code = token.charCodeAt(idx);
        const bit = (code + x * 7 + y * 11) % 2;
        if (bit === 1) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#111"/>`;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * cell}" height="${size * cell}" viewBox="0 0 ${size * cell} ${size * cell}"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  function downloadWalletFile(order) {
    const dt = ticketDateTime(order);
    const end = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
    const formatIcs = (date) => {
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const min = String(date.getUTCMinutes()).padStart(2, "0");
      return `${yyyy}${mm}${dd}T${hh}${min}00Z`;
    };
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BOOQDAT//EN",
      "BEGIN:VEVENT",
      `UID:${order.id}@booqdat.com`,
      `DTSTAMP:${formatIcs(new Date())}`,
      `DTSTART:${formatIcs(dt)}`,
      `DTEND:${formatIcs(end)}`,
      `SUMMARY:${order.eventTitle}`,
      `LOCATION:${order.venue}, ${order.city}, ${order.state}`,
      `DESCRIPTION:Ticket token ${order.ticketToken}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${order.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printReceipt(order) {
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      showFeedback("Receipt popup blocked. Please allow popups and try again.");
      return;
    }
    popup.document.write(`
      <html>
        <head>
          <title>Receipt ${order.id}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #1f1f1f; }
            h1 { margin-bottom: 8px; }
            .muted { color: #666; margin-bottom: 20px; }
            .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
          </style>
        </head>
        <body>
          <h1>BOOQDAT Receipt</h1>
          <p class="muted">Order ${order.id}</p>
          <div class="card">
            <div class="row"><span>Event</span><strong>${order.eventTitle}</strong></div>
            <div class="row"><span>Date</span><strong>${formatDate(order.eventDate)} ${formatTime(order.eventTime)}</strong></div>
            <div class="row"><span>Attendee</span><strong>${order.attendee.name}</strong></div>
            <div class="row"><span>Email</span><strong>${order.attendee.email}</strong></div>
            <div class="row"><span>Quantity</span><strong>${order.quantity}</strong></div>
            <div class="row"><span>Subtotal</span><strong>${usd(order.subtotal)}</strong></div>
            <div class="row"><span>Fees</span><strong>${usd(order.fee)}</strong></div>
            <div class="row"><span>Total</span><strong>${usd(order.total)}</strong></div>
          </div>
          <p>Use your browser print dialog and choose <strong>Save as PDF</strong>.</p>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function renderTickets() {
    if (!upcomingGrid || !pastGrid) return;
    const orders = ordersForEmail(activeEmail);
    const upcoming = orders.filter(isUpcoming);
    const past = orders.filter((order) => !isUpcoming(order));

    function card(order) {
      return `
        <article class="ticket-card">
          <div class="ticket-thumb">
            <span>${order.ticketType}</span>
          </div>
          <div class="ticket-body">
            <h3>${order.eventTitle}</h3>
            <p class="ticket-meta">${formatDate(order.eventDate)} • ${formatTime(order.eventTime)} • ${order.venue}</p>
            <p class="ticket-meta">Order ${order.id} • Status: <span class="status-pill ${statusClass(orderStatusLabel(order))}">${orderStatusLabel(order)}</span></p>
            <div class="ticket-qr-wrap">
              <img src="${pseudoQrSvgData(order.ticketToken)}" alt="Ticket QR code for ${order.eventTitle}">
            </div>
            <div class="ticket-actions">
              <button class="btn btn-secondary" type="button" data-ticket-action="wallet" data-order-id="${order.id}">Add to Wallet</button>
              <button class="btn btn-secondary" type="button" data-ticket-action="transfer" data-order-id="${order.id}">Transfer Ticket</button>
              <button class="btn btn-secondary" type="button" data-ticket-action="refund" data-order-id="${order.id}" ${canRefund(order) ? "" : "disabled"}>Request Refund</button>
              <button class="btn btn-secondary" type="button" data-ticket-action="details" data-order-id="${order.id}">View Order Details</button>
            </div>
          </div>
        </article>
      `;
    }

    upcomingGrid.innerHTML = upcoming.length
      ? upcoming.map(card).join("")
      : `<article class="promoter-card"><h3>No upcoming tickets</h3><p>Purchase tickets as a guest and access them here by using the same email address.</p></article>`;

    pastGrid.innerHTML = past.length
      ? past.map(card).join("")
      : `<article class="promoter-card"><h3>No past tickets yet</h3></article>`;
  }

  function renderHistory() {
    if (!historyBody) return;
    const orders = ordersForEmail(activeEmail);
    historyBody.innerHTML = orders.length
      ? orders.map((order) => `
          <tr>
            <td>${formatDate(order.purchaseDate.slice(0, 10))}</td>
            <td>${order.eventTitle}</td>
            <td>${usd(order.total)}</td>
            <td><span class="status-pill ${statusClass(orderStatusLabel(order))}">${orderStatusLabel(order)}</span></td>
            <td><button class="btn btn-secondary btn-sm" type="button" data-history-action="receipt" data-order-id="${order.id}">Download Receipt PDF</button></td>
          </tr>
        `).join("")
      : `<tr><td colspan="5">No purchase history yet.</td></tr>`;
  }

  function renderProfile() {
    if (!profileForm) return;
    const profile = readProfile(activeEmail);
    profileForm.elements.name.value = profile.name || "";
    profileForm.elements.email.value = profile.email || activeEmail;
    profileForm.elements.phone.value = profile.phone || "";
    profileForm.elements.reminders.checked = profile.reminders !== false;
    profileForm.elements.promotions.checked = profile.promotions === true;
  }

  function renderPaymentMethods() {
    if (!paymentList) return;
    const methods = readMethods(activeEmail);
    paymentList.innerHTML = methods.length
      ? methods.map((method, idx) => `
          <article class="payment-card">
            <h4>${method.provider}</h4>
            <p>•••• ${method.last4} • Expires ${method.exp}</p>
            <button class="btn btn-secondary btn-sm" type="button" data-payment-action="remove" data-method-index="${idx}">Remove</button>
          </article>
        `).join("")
      : `<article class="promoter-card"><p>No saved payment methods yet.</p></article>`;
  }

  function renderFavorites() {
    if (!savedFavorites || !discoverFavorites) return;
    const favoriteIds = new Set(readFavorites(activeEmail));
    const events = getAllEvents();
    const saved = events.filter((event) => favoriteIds.has(event.id));
    const discover = events.filter((event) => !favoriteIds.has(event.id)).slice(0, 8);

    const card = (event, isSaved) => `
      <article class="favorite-card">
        <h4>${event.title}</h4>
        <p>${formatDate(event.date)} • ${event.city}, ${event.state}</p>
        <p>From ${usd(event.price)}</p>
        <div class="ticket-actions">
          <a href="checkout.html?event=${encodeURIComponent(event.id)}" class="btn btn-secondary">Buy</a>
          <button class="btn btn-secondary" type="button" data-favorite-action="${isSaved ? "remove" : "save"}" data-event-id="${event.id}">
            ${isSaved ? "Remove" : "Save Event"}
          </button>
        </div>
      </article>
    `;

    savedFavorites.innerHTML = saved.length
      ? saved.map((event) => card(event, true)).join("")
      : `<article class="promoter-card"><p>No saved events yet.</p></article>`;
    discoverFavorites.innerHTML = discover.length
      ? discover.map((event) => card(event, false)).join("")
      : `<article class="promoter-card"><p>No additional events to suggest right now.</p></article>`;
  }

  function renderAllPortalData() {
    if (accountLabel) accountLabel.textContent = activeEmail;
    renderTickets();
    renderHistory();
    renderProfile();
    renderPaymentMethods();
    renderFavorites();
  }

  function showPortal() {
    if (authGate) authGate.classList.add("hidden");
    if (portalMain) portalMain.classList.remove("hidden");
  }

  function showAuth() {
    if (authGate) authGate.classList.remove("hidden");
    if (portalMain) portalMain.classList.add("hidden");
    clearFeedback();
  }

  function switchTab(tab) {
    activeTab = tab;
    root.querySelectorAll("[data-user-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.userTab === tab));
    root.querySelectorAll("[data-user-section]").forEach((section) => {
      section.classList.toggle("hidden", section.dataset.userSection !== tab);
    });
  }

  function loginToPortal(email, name = "") {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    activeEmail = normalized;
    const profile = readProfile(normalized);
    if (name && !profile.name) profile.name = name;
    profile.email = normalized;
    writeProfile(normalized, profile);
    writeUserPortalSession({ email: normalized });
    showPortal();
    switchTab("tickets");
    renderAllPortalData();
  }

  async function logoutPortal() {
    activeEmail = "";
    writeUserPortalSession({ email: "" });
    await logoutCurrentSession();
    showAuth();
  }

  root.querySelectorAll("[data-user-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      const tab = button.dataset.userTab;
      if (tab === "logout") {
        await logoutPortal();
        return;
      }
      switchTab(tab);
    });
  });

  if (loginForm && loginEmailInput && loginPasswordInput) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = normalizeEmail(loginEmailInput.value);
      const password = String(loginPasswordInput.value || "");
      if (!email || !password) {
        showFeedback("Email and password are required.");
        return;
      }

      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      const tokens = extractAuthTokens(response);
      if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
        showFeedback(response?.error || "Unable to sign in.");
        return;
      }
      if (!hasAnyRole(response.user, ["user", "admin"])) {
        showFeedback("Use a user account to access the portal.");
        return;
      }
      writeAuthSession({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: response.user
      });
      loginToPortal(response.user.email, loginNameInput?.value || response.user.name || "");
      loginPasswordInput.value = "";
      if (loginNameInput) loginNameInput.value = "";
    });
  }

  if (profileForm && profileStatus) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(profileForm);
      const nextEmail = normalizeEmail(formData.get("email"));
      const nextProfile = {
        name: String(formData.get("name") || "").trim(),
        email: nextEmail,
        phone: String(formData.get("phone") || "").trim(),
        reminders: Boolean(formData.get("reminders")),
        promotions: Boolean(formData.get("promotions"))
      };

      if (!nextEmail) {
        profileStatus.textContent = "Email is required.";
        return;
      }

      if (nextEmail !== activeEmail) {
        profileStatus.textContent = "Email changes are disabled for secure accounts. Contact support to update email.";
        return;
      }

      writeProfile(activeEmail, nextProfile);

      profileStatus.textContent = "Profile updated successfully.";
      renderAllPortalData();
    });
  }

  if (paymentForm && paymentStatus) {
    paymentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(paymentForm);
      const provider = String(formData.get("provider") || "");
      const last4 = String(formData.get("last4") || "").replace(/\D/g, "").slice(-4);
      const exp = String(formData.get("exp") || "").trim();
      if (!provider || last4.length !== 4 || !exp) {
        paymentStatus.textContent = "Enter provider, last 4 digits, and expiration.";
        return;
      }
      const methods = readMethods(activeEmail);
      methods.unshift({ provider, last4, exp });
      writeMethods(activeEmail, methods);
      paymentStatus.textContent = "Payment method saved.";
      paymentForm.reset();
      renderPaymentMethods();
    });
  }

  root.addEventListener("click", async (event) => {
    const ticketButton = event.target.closest("[data-ticket-action]");
    if (ticketButton) {
      const action = ticketButton.dataset.ticketAction;
      const orderId = ticketButton.dataset.orderId;
      const orders = allOrders();
      const order = orders.find((item) => item.id === orderId && normalizeEmail(item?.attendee?.email) === activeEmail);
      if (!order) return;

      if (action === "wallet") {
        downloadWalletFile(order);
        showFeedback(`Wallet file downloaded for <strong>${order.eventTitle}</strong>.`);
      }

      if (action === "transfer") {
        const recipient = prompt("Transfer ticket to email:");
        if (!recipient) return;
        showFeedback(`Transfer initiated from <strong>${order.attendee.email}</strong> to <strong>${recipient}</strong>.`);
      }

      if (action === "refund") {
        if (!canRefund(order)) {
          showFeedback(`Refund is not available for <strong>${order.eventTitle}</strong> under current policy.`);
          return;
        }
        order.status = "Refund Requested";
        saveOrders(orders);
        renderTickets();
        renderHistory();
        showFeedback(`Refund requested for <strong>${order.eventTitle}</strong>.`);
      }

      if (action === "details") {
        showFeedback(`
          <strong>Order Details</strong><br>
          Event: ${order.eventTitle}<br>
          Date: ${formatDate(order.eventDate)} at ${formatTime(order.eventTime)}<br>
          Quantity: ${order.quantity}<br>
          Total: ${usd(order.total)}<br>
          Ticket Token: ${order.ticketToken}
        `);
      }
      return;
    }

    const historyButton = event.target.closest("[data-history-action='receipt']");
    if (historyButton) {
      const orderId = historyButton.dataset.orderId;
      const order = ordersForEmail(activeEmail).find((item) => item.id === orderId);
      if (!order) return;
      printReceipt(order);
      return;
    }

    const paymentButton = event.target.closest("[data-payment-action='remove']");
    if (paymentButton) {
      const idx = Number(paymentButton.dataset.methodIndex);
      const methods = readMethods(activeEmail);
      methods.splice(idx, 1);
      writeMethods(activeEmail, methods);
      renderPaymentMethods();
      showFeedback("Payment method removed.");
      return;
    }

    const favButton = event.target.closest("[data-favorite-action]");
    if (favButton) {
      const eventId = favButton.dataset.eventId;
      const action = favButton.dataset.favoriteAction;
      const favorites = new Set(readFavorites(activeEmail));
      if (action === "save") favorites.add(eventId);
      if (action === "remove") favorites.delete(eventId);
      writeFavorites(activeEmail, [...favorites]);
      renderFavorites();
      return;
    }
  });

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      root.classList.toggle("sidebar-open");
    });
  }

  const authSession = readAuthSession();
  const authEmail = normalizeEmail(authSession?.user?.email);
  const authRole = normalizeRole(authSession?.user?.role);

  if ((authRole === "user" || authRole === "admin") && authEmail) {
    loginToPortal(authEmail, authSession?.user?.name || "");
  } else {
    showAuth();
    if (loginEmailInput) {
      const url = new URL(window.location.href);
      const emailFromQuery = normalizeEmail(url.searchParams.get("email"));
      if (emailFromQuery) loginEmailInput.value = emailFromQuery;
    }
  }
}

function setupPromoterDashboard() {
  const root = document.querySelector("#promoter-dashboard");
  if (!root) return;

  const wizardForm = root.querySelector("#promoter-wizard-form");
  const wizardSteps = root.querySelectorAll(".wizard-step");
  const wizardIndicators = root.querySelectorAll("[data-wizard-indicator]");
  const wizardPrev = root.querySelector("[data-wizard-prev]");
  const wizardNext = root.querySelector("[data-wizard-next]");
  const wizardDraft = root.querySelector("[data-wizard-draft]");
  const wizardPublish = root.querySelector("[data-wizard-publish]");
  const wizardReview = root.querySelector("#wizard-review");
  const wizardOutput = root.querySelector("#wizard-publish-output");
  const eventsList = root.querySelector("#promoter-events-list");
  const feedback = root.querySelector("#promoter-action-feedback");
  const topReferrersBody = root.querySelector("#top-referrers-body");
  const payoutHistoryBody = root.querySelector("#payout-history-body");

  let currentStep = 1;
  let currentTab = "upcoming";
  let editingEventId = null;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function dateOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function currentPromoterEmail() {
    return normalizeEmail(getActivePromoterEmail());
  }

  function averagePrice(event) {
    const ticketTypes = event.ticketTypes || [];
    const valid = ticketTypes.filter((ticket) => toNumber(ticket.price) > 0);
    if (!valid.length) return 25;
    return valid.reduce((sum, ticket) => sum + toNumber(ticket.price), 0) / valid.length;
  }

  function totalInventory(event) {
    const ticketTypes = event.ticketTypes || [];
    const ticketQty = ticketTypes.reduce((sum, ticket) => sum + toNumber(ticket.quantity), 0);
    return Math.max(1, ticketQty || toNumber(event.capacity, 1));
  }

  function computeRevenue(event) {
    if (toNumber(event.revenue) > 0) return toNumber(event.revenue);
    return Math.round(toNumber(event.ticketsSold) * averagePrice(event));
  }

  function eventStatus(event) {
    if (event.status === "Draft") return "Draft";
    if (event.status === "Paused") return "Paused";
    if (toNumber(event.ticketsSold) >= totalInventory(event)) return "Sold Out";
    if (event.date && event.date < todayKey) return "Past";
    return "Live";
  }

  function classifyEventTab(event) {
    const status = eventStatus(event);
    if (status === "Draft") return "drafts";
    if (status === "Past") return "past";
    return "upcoming";
  }

  function createDefaultTicketTypes() {
    return [
      {
        name: "General Admission",
        price: 35,
        quantity: 300,
        salesStart: dateOffset(-7),
        salesEnd: dateOffset(21)
      },
      {
        name: "VIP",
        price: 75,
        quantity: 80,
        salesStart: dateOffset(-7),
        salesEnd: dateOffset(21)
      }
    ];
  }

  function mapPromoterEventToMarketplace(event) {
    const prices = (event.ticketTypes || []).map((ticket) => toNumber(ticket.price)).filter((price) => price > 0);
    const minPrice = prices.length ? Math.min(...prices) : 25;
    return {
      id: event.id,
      title: event.title,
      category: event.category || "Community",
      venue: event.venue || "Venue TBA",
      city: event.city || "Albuquerque",
      state: event.state || "NM",
      date: event.date || dateOffset(14),
      time: event.time || "19:00",
      price: minPrice,
      capacity: totalInventory(event),
      description: event.description || "",
      banner: event.banner || "",
      promoterEmail: normalizeEmail(event.promoterEmail || currentPromoterEmail())
    };
  }

  function syncMarketplace(event) {
    const status = eventStatus(event);
    if (status === "Draft") {
      removeStoredEventById(event.id);
      return;
    }
    upsertStoredEvent(mapPromoterEventToMarketplace(event));
  }

  function showFeedback(message) {
    if (!feedback) return;
    feedback.classList.remove("hidden");
    feedback.innerHTML = message;
  }

  function seedPromoterEvents() {
    const existing = readPromoterDashboardEvents();
    if (existing.length) return existing;
    const seeded = [
      {
        id: `evt-pr-${Date.now()}-1`,
        title: "Skyline Bass Social",
        description: "Open-air evening event with guest DJs and visual installations.",
        category: "Music",
        tags: ["nightlife", "electronic"],
        date: dateOffset(10),
        time: "20:00",
        venueType: "Physical",
        venue: "Skyline Roof Lounge",
        city: "Albuquerque",
        state: "NM",
        capacity: 420,
        ticketTypes: createDefaultTicketTypes(),
        banner: "",
        promoCodes: ["EARLY10"],
        status: "Live",
        ticketsSold: 226,
        revenue: 9870,
        createdAt: new Date().toISOString()
      },
      {
        id: `evt-pr-${Date.now()}-2`,
        title: "Founder Mixer: Creative Southwest",
        description: "Founder networking meetup with panel sessions and live Q&A.",
        category: "Business",
        tags: ["networking", "founders"],
        date: dateOffset(-14),
        time: "17:30",
        venueType: "Physical",
        venue: "Innovate Hall",
        city: "Phoenix",
        state: "AZ",
        capacity: 250,
        ticketTypes: [
          {
            name: "General Admission",
            price: 25,
            quantity: 250,
            salesStart: dateOffset(-32),
            salesEnd: dateOffset(-14)
          }
        ],
        banner: "",
        promoCodes: [],
        status: "Live",
        ticketsSold: 190,
        revenue: 4750,
        createdAt: new Date().toISOString()
      },
      {
        id: `evt-pr-${Date.now()}-3`,
        title: "Downtown Comedy Trial Run",
        description: "Draft event for pilot comedy format and open mic format testing.",
        category: "Comedy",
        tags: ["comedy", "open-mic"],
        date: dateOffset(20),
        time: "21:00",
        venueType: "Physical",
        venue: "Mesa Stage Hall",
        city: "Albuquerque",
        state: "NM",
        capacity: 220,
        ticketTypes: [
          {
            name: "General Admission",
            price: 30,
            quantity: 220,
            salesStart: dateOffset(2),
            salesEnd: dateOffset(19)
          }
        ],
        banner: "",
        promoCodes: ["LAUNCH15"],
        status: "Draft",
        ticketsSold: 0,
        revenue: 0,
        createdAt: new Date().toISOString()
      }
    ];
    writePromoterDashboardEvents(seeded);
    seeded.filter((event) => eventStatus(event) !== "Draft").forEach(syncMarketplace);
    return seeded;
  }

  let promoterEvents = seedPromoterEvents();

  function persistEvents() {
    writePromoterDashboardEvents(promoterEvents);
  }

  function updatePromoterKpis() {
    const upcomingEvents = promoterEvents.filter((event) => classifyEventTab(event) === "upcoming").length;
    const ticketsSold = promoterEvents.reduce((sum, event) => sum + toNumber(event.ticketsSold), 0);
    const totalRevenue = promoterEvents.reduce((sum, event) => sum + computeRevenue(event), 0);
    const totalNet = Math.round(totalRevenue * 0.92);
    const pendingPayout = Math.round(totalNet * 0.24);

    const kpiValues = {
      "upcoming-events": upcomingEvents.toLocaleString(),
      "total-tickets-sold": ticketsSold.toLocaleString(),
      "total-earnings": usd(totalNet),
      "pending-payouts": usd(pendingPayout)
    };
    Object.entries(kpiValues).forEach(([key, value]) => {
      const target = root.querySelector(`[data-promoter-kpi="${key}"]`);
      if (target) target.textContent = value;
    });
  }

  function renderEventCards() {
    if (!eventsList) return;
    const rows = promoterEvents.filter((event) => classifyEventTab(event) === currentTab);
    if (!rows.length) {
      eventsList.innerHTML = `<article class="promoter-card"><h3>No events in this tab</h3><p>Create a new event or switch tabs to view existing records.</p></article>`;
      return;
    }

    eventsList.innerHTML = rows.map((event) => {
      const status = eventStatus(event);
      const statusClass = status.toLowerCase().replace(/\s+/g, "");
      const inventory = totalInventory(event);
      const sold = Math.min(inventory, toNumber(event.ticketsSold));
      const soldPct = Math.min(100, Math.round((sold / inventory) * 100));
      const revenue = computeRevenue(event);
      const pauseLabel = status === "Paused" ? "Resume Sales" : "Pause Sales";
      return `
        <article class="promoter-event-card">
          <div class="promoter-event-head">
            <h3>${event.title}</h3>
            <span class="promoter-status-pill ${statusClass}">${status}</span>
          </div>
          <p class="promoter-meta">${formatDate(event.date)} • ${formatTime(event.time)} • ${event.venue}, ${event.city}</p>
          <div class="progress-inline">
            <span><strong>Tickets Sold</strong><strong>${soldPct}%</strong></span>
            <div class="bar-track"><div class="bar-fill" style="width:${soldPct}%"></div></div>
          </div>
          <p class="promoter-meta"><strong>Revenue:</strong> ${usd(revenue)} • <strong>Net:</strong> ${usd(Math.round(revenue * 0.92))}</p>
          <div class="event-action-row">
            <button class="btn btn-secondary" type="button" data-event-action="edit" data-event-id="${event.id}">Edit</button>
            <button class="btn btn-secondary" type="button" data-event-action="view" data-event-id="${event.id}">View Tickets</button>
            <button class="btn btn-secondary" type="button" data-event-action="csv" data-event-id="${event.id}">Download CSV</button>
            <button class="btn btn-secondary" type="button" data-event-action="share" data-event-id="${event.id}">Share Link</button>
            <button class="btn btn-secondary" type="button" data-event-action="pause" data-event-id="${event.id}">${pauseLabel}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function setWizardInput(name, value) {
    const field = wizardForm?.elements?.namedItem(name);
    if (!field) return;
    field.value = value ?? "";
  }

  function collectWizardData() {
    if (!wizardForm) return null;
    const formData = new FormData(wizardForm);
    const parseTags = String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const parsePromo = String(formData.get("promoCodes") || "")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    const ticketTypes = [
      {
        name: "General Admission",
        price: toNumber(formData.get("gaPrice")),
        quantity: toNumber(formData.get("gaQty")),
        salesStart: String(formData.get("gaStart") || ""),
        salesEnd: String(formData.get("gaEnd") || "")
      },
      {
        name: "VIP",
        price: toNumber(formData.get("vipPrice")),
        quantity: toNumber(formData.get("vipQty")),
        salesStart: String(formData.get("vipStart") || ""),
        salesEnd: String(formData.get("vipEnd") || "")
      }
    ].filter((ticket) => ticket.quantity > 0 || ticket.price > 0);

    return {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      category: String(formData.get("category") || "Community"),
      tags: parseTags,
      date: String(formData.get("date") || ""),
      time: String(formData.get("time") || ""),
      venueType: String(formData.get("venueType") || "Physical"),
      venue: String(formData.get("venue") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      capacity: toNumber(formData.get("capacity"), 1),
      ticketTypes: ticketTypes.length ? ticketTypes : createDefaultTicketTypes(),
      banner: String(formData.get("banner") || "").trim(),
      promoCodes: parsePromo
    };
  }

  function renderWizardReview() {
    if (!wizardReview) return;
    const data = collectWizardData();
    if (!data) return;
    const lowPrice = Math.min(...data.ticketTypes.map((ticket) => toNumber(ticket.price, 0)).filter((value) => value > 0), 0);
    wizardReview.innerHTML = `
      <h4>${data.title || "Untitled Event"}</h4>
      <p>${data.description || "No description provided."}</p>
      <ul>
        <li><strong>Category:</strong> ${data.category}</li>
        <li><strong>Date & Time:</strong> ${data.date ? `${formatDate(data.date)} at ${formatTime(data.time)}` : "Not set"}</li>
        <li><strong>Venue:</strong> ${data.venue || "Venue not set"} (${data.venueType})</li>
        <li><strong>Location:</strong> ${data.city || "City"}, ${data.state || "State"}</li>
        <li><strong>Capacity:</strong> ${data.capacity.toLocaleString()}</li>
        <li><strong>Ticket Types:</strong> ${data.ticketTypes.map((ticket) => `${ticket.name} ${usd(ticket.price)} x ${ticket.quantity}`).join(" • ")}</li>
        <li><strong>Promo Codes:</strong> ${data.promoCodes.length ? data.promoCodes.join(", ") : "None"}</li>
        <li><strong>Starting Price:</strong> ${lowPrice > 0 ? usd(lowPrice) : "N/A"}</li>
      </ul>
    `;
  }

  function validateStep(stepNumber) {
    const stepEl = root.querySelector(`.wizard-step[data-step="${stepNumber}"]`);
    if (!stepEl) return true;
    const requiredFields = stepEl.querySelectorAll("[required]");
    for (const field of requiredFields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function setWizardStep(step) {
    currentStep = Math.max(1, Math.min(5, step));
    wizardSteps.forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.step) === currentStep));
    wizardIndicators.forEach((item) => item.classList.toggle("is-active", Number(item.dataset.wizardIndicator) === currentStep));
    if (wizardPrev) wizardPrev.classList.toggle("hidden", currentStep === 1);
    if (wizardNext) wizardNext.classList.toggle("hidden", currentStep === 5);
    if (wizardDraft) wizardDraft.classList.toggle("hidden", currentStep !== 5);
    if (wizardPublish) wizardPublish.classList.toggle("hidden", currentStep !== 5);
    if (currentStep === 5) renderWizardReview();
  }

  function downloadCsvForEvent(event) {
    const totalRows = Math.min(40, Math.max(8, toNumber(event.ticketsSold, 8)));
    const rows = [];
    for (let i = 1; i <= totalRows; i += 1) {
      rows.push(`${event.id}-${String(i).padStart(4, "0")},attendee${i}@example.com,${event.title},${formatDate(event.date)}`);
    }
    const csv = ["ticket_id,email,event,date", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tickets.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getShareLink(eventId) {
    return `${window.location.origin}/checkout.html?event=${encodeURIComponent(eventId)}`;
  }

  function drawLineChart(canvas, values, color) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padX = 44;
    const padY = 24;
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = Math.max(1, max - min);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#f3d6bf";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padY + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
    }

    const points = values.map((value, index) => {
      const x = padX + (index / (values.length - 1 || 1)) * plotWidth;
      const y = padY + ((max - value) / range) * plotHeight;
      return { x, y };
    });

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  function renderHeatmap() {
    const target = root.querySelector("#purchase-heatmap");
    if (!target) return;
    const slots = ["6a", "9a", "12p", "3p", "6p", "9p"];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const cells = [];
    days.forEach((day, dayIndex) => {
      slots.forEach((slot, slotIndex) => {
        const intensity = Math.min(1, 0.2 + ((dayIndex * 0.11 + slotIndex * 0.12) % 0.78));
        const alpha = 0.12 + intensity * 0.58;
        const volume = Math.round(18 + intensity * 92);
        cells.push(`<div class="heat-cell" style="background: rgba(249, 115, 22, ${alpha});" title="${day} ${slot}: ${volume} purchases">${volume}</div>`);
      });
    });
    target.innerHTML = cells.join("");
  }

  function renderReferrers() {
    if (!topReferrersBody) return;
    const rows = [
      { source: "Instagram", visits: 4820, conversions: 692 },
      { source: "TikTok", visits: 3765, conversions: 488 },
      { source: "Direct Link", visits: 2910, conversions: 615 },
      { source: "Email Campaign", visits: 1980, conversions: 362 },
      { source: "Partner Site", visits: 1120, conversions: 143 }
    ];
    topReferrersBody.innerHTML = rows.map((row) => `<tr><td>${row.source}</td><td>${row.visits.toLocaleString()}</td><td>${row.conversions.toLocaleString()}</td></tr>`).join("");
  }

  function renderDemographics() {
    const target = root.querySelector("#promoter-demographics");
    if (!target) return;
    const ranges = {
      "18-24": 28,
      "25-34": 41,
      "35-44": 18,
      "45-54": 9,
      "55+": 4
    };
    const entries = Object.entries(ranges);
    target.innerHTML = entries.map(([label, percent]) => `
      <div class="bar-item">
        <div class="bar-item-head"><span>${label}</span><strong>${percent}%</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      </div>
    `).join("");
  }

  function renderPayoutHistory() {
    if (!payoutHistoryBody) return;
    const rows = promoterEvents
      .filter((event) => eventStatus(event) !== "Draft")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8)
      .map((event) => {
        const gross = computeRevenue(event);
        const net = Math.round(gross * 0.92);
        const status = event.date < todayKey ? "Processed" : "Scheduled";
        const statusClass = status === "Processed" ? "approved" : "pending";
        return `
          <tr>
            <td>${formatDate(event.date)}</td>
            <td>${event.title}</td>
            <td>${usd(gross)}</td>
            <td>${usd(net)}</td>
            <td><span class="status-pill ${statusClass}">${status}</span></td>
          </tr>
        `;
      });
    payoutHistoryBody.innerHTML = rows.join("");
  }

  function renderAnalytics() {
    const salesCanvas = root.querySelector("#promoter-sales-chart");
    const revenueCanvas = root.querySelector("#promoter-revenue-chart");
    const totalSold = promoterEvents.reduce((sum, event) => sum + toNumber(event.ticketsSold), 0);
    const totalRevenue = promoterEvents.reduce((sum, event) => sum + computeRevenue(event), 0);

    const salesSeries = [12, 18, 22, 26, 33, 38, 44, 51, 48, 56, 63, 70].map((value) => Math.round(value + totalSold * 0.01));
    const revenueSeries = [1600, 2100, 2400, 2800, 3200, 3600, 3900, 4200, 4600, 5100, 5400, 5900].map((value) => Math.round(value + totalRevenue * 0.001));

    drawLineChart(salesCanvas, salesSeries, "#f97316");
    drawLineChart(revenueCanvas, revenueSeries, "#ea580c");
    renderDemographics();
    renderHeatmap();
    renderReferrers();
  }

  function fillWizardFromEvent(event) {
    setWizardInput("title", event.title);
    setWizardInput("description", event.description);
    setWizardInput("category", event.category);
    setWizardInput("tags", (event.tags || []).join(", "));
    setWizardInput("date", event.date);
    setWizardInput("time", event.time);
    setWizardInput("venueType", event.venueType || "Physical");
    setWizardInput("venue", event.venue);
    setWizardInput("city", event.city);
    setWizardInput("state", event.state);
    setWizardInput("capacity", event.capacity);

    const ga = (event.ticketTypes || []).find((ticket) => ticket.name === "General Admission") || {};
    const vip = (event.ticketTypes || []).find((ticket) => ticket.name === "VIP") || {};
    setWizardInput("gaPrice", toNumber(ga.price, 35));
    setWizardInput("gaQty", toNumber(ga.quantity, 300));
    setWizardInput("gaStart", ga.salesStart || "");
    setWizardInput("gaEnd", ga.salesEnd || "");
    setWizardInput("vipPrice", toNumber(vip.price, 75));
    setWizardInput("vipQty", toNumber(vip.quantity, 0));
    setWizardInput("vipStart", vip.salesStart || "");
    setWizardInput("vipEnd", vip.salesEnd || "");
    setWizardInput("banner", event.banner || "");
    setWizardInput("promoCodes", (event.promoCodes || []).join(", "));
  }

  function resetWizardState() {
    if (wizardForm) wizardForm.reset();
    editingEventId = null;
    if (wizardOutput) wizardOutput.classList.add("hidden");
    setWizardStep(1);
  }

  function saveWizardEvent(asDraft) {
    for (let step = 1; step <= 4; step += 1) {
      if (!validateStep(step)) {
        setWizardStep(step);
        return;
      }
    }

    const data = collectWizardData();
    if (!data) return;

    const existing = promoterEvents.find((event) => event.id === editingEventId);
    const inventory = Math.max(1, data.ticketTypes.reduce((sum, ticket) => sum + toNumber(ticket.quantity), 0) || toNumber(data.capacity, 1));
    const preservedSold = existing ? Math.min(inventory, toNumber(existing.ticketsSold)) : 0;
    const sold = asDraft ? 0 : Math.max(preservedSold, Math.round(inventory * 0.22));
    const average = data.ticketTypes.filter((ticket) => toNumber(ticket.price) > 0).reduce((sum, ticket) => sum + toNumber(ticket.price), 0) / Math.max(1, data.ticketTypes.filter((ticket) => toNumber(ticket.price) > 0).length);

    const finalEvent = {
      ...(existing || {}),
      ...data,
      id: existing?.id || `evt-pr-${Date.now()}`,
      status: asDraft ? "Draft" : "Live",
      ticketsSold: sold,
      revenue: Math.round(sold * (average || 25)),
      promoterEmail: normalizeEmail(existing?.promoterEmail || currentPromoterEmail()),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    const idx = promoterEvents.findIndex((event) => event.id === finalEvent.id);
    if (idx >= 0) promoterEvents[idx] = finalEvent;
    else promoterEvents.unshift(finalEvent);

    persistEvents();
    syncMarketplace(finalEvent);
    updatePromoterKpis();
    renderEventCards();
    renderAnalytics();
    renderPayoutHistory();

    const shareLink = getShareLink(finalEvent.id);
    if (wizardOutput) {
      wizardOutput.classList.remove("hidden");
      wizardOutput.innerHTML = asDraft
        ? `<strong>Draft saved.</strong><br>Finish and publish when ready.`
        : `<strong>Event published successfully.</strong><br>Share link: <a href="${shareLink}" target="_blank" rel="noopener">${shareLink}</a>`;
    }

    showFeedback(`<strong>${finalEvent.title}</strong> ${asDraft ? "saved as draft" : "published"} successfully.`);
    resetWizardState();
    if (!asDraft) {
      notifyPromoterEventPublished(finalEvent, shareLink);
      const createSection = root.querySelector("#promoter-events");
      if (createSection) createSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  root.querySelectorAll("[data-event-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      currentTab = button.dataset.eventTab || "upcoming";
      root.querySelectorAll("[data-event-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderEventCards();
    });
  });

  if (eventsList) {
    eventsList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-event-action]");
      if (!button) return;
      const action = button.dataset.eventAction;
      const eventId = button.dataset.eventId;
      const targetEvent = promoterEvents.find((item) => item.id === eventId);
      if (!targetEvent) return;

      if (action === "edit") {
        editingEventId = targetEvent.id;
        fillWizardFromEvent(targetEvent);
        setWizardStep(1);
        const section = root.querySelector("#promoter-create");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        showFeedback(`<strong>${targetEvent.title}</strong> loaded into editor.`);
      }

      if (action === "view") {
        showFeedback(`<strong>${targetEvent.title}</strong> has ${toNumber(targetEvent.ticketsSold).toLocaleString()} sold tickets. Use CSV export for attendee-level records.`);
      }

      if (action === "csv") {
        downloadCsvForEvent(targetEvent);
        showFeedback(`CSV exported for <strong>${targetEvent.title}</strong>.`);
      }

      if (action === "share") {
        const shareLink = getShareLink(targetEvent.id);
        try {
          await navigator.clipboard.writeText(shareLink);
          showFeedback(`Link copied: <a href="${shareLink}" target="_blank" rel="noopener">${shareLink}</a>`);
        } catch {
          showFeedback(`Share link: <a href="${shareLink}" target="_blank" rel="noopener">${shareLink}</a>`);
        }
      }

      if (action === "pause") {
        const status = eventStatus(targetEvent);
        if (status === "Sold Out") {
          showFeedback(`<strong>${targetEvent.title}</strong> is sold out and cannot be paused.`);
          return;
        }
        targetEvent.status = status === "Paused" ? "Live" : "Paused";
        persistEvents();
        syncMarketplace(targetEvent);
        updatePromoterKpis();
        renderEventCards();
        showFeedback(`<strong>${targetEvent.title}</strong> is now ${targetEvent.status}.`);
      }
    });
  }

  if (wizardNext) {
    wizardNext.addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      setWizardStep(currentStep + 1);
    });
  }
  if (wizardPrev) {
    wizardPrev.addEventListener("click", () => setWizardStep(currentStep - 1));
  }
  if (wizardDraft) {
    wizardDraft.addEventListener("click", () => saveWizardEvent(true));
  }
  if (wizardPublish) {
    wizardPublish.addEventListener("click", () => saveWizardEvent(false));
  }

  root.querySelectorAll("[data-scroll-create]").forEach((button) => {
    button.addEventListener("click", () => {
      const createSection = root.querySelector("#promoter-create");
      if (createSection) createSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const payoutScheduleSelect = root.querySelector("#payout-schedule-select");
  const payoutScheduleInfo = root.querySelector("#payout-schedule-info");
  if (payoutScheduleSelect && payoutScheduleInfo) {
    payoutScheduleSelect.addEventListener("change", () => {
      payoutScheduleInfo.textContent = payoutScheduleSelect.value === "monthly"
        ? "Monthly payouts are issued on the 5th business day of each month."
        : "Weekly payouts are issued every Friday for cleared transactions.";
    });
  }

  const bankConnectForm = root.querySelector("#bank-connect-form");
  const bankConnectStatus = root.querySelector("#bank-connect-status");
  if (bankConnectForm && bankConnectStatus) {
    bankConnectForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(bankConnectForm);
      const provider = formData.get("provider");
      const email = formData.get("email");
      bankConnectStatus.textContent = `${provider} account connected for ${email}. Verification is in progress.`;
      bankConnectForm.reset();
    });
  }

  const profileForm = root.querySelector("#promoter-settings-form");
  const profileStatus = root.querySelector("#promoter-settings-status");
  if (profileForm && profileStatus) {
    const profile = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.promoter) || "{}");
      } catch {
        return {};
      }
    })();
    profileForm.elements.name.value = profile.name || "Promoter Account";
    profileForm.elements.email.value = profile.email || "";
    profileForm.elements.phone.value = profile.phone || "";
    profileForm.elements.location.value = profile.location || "";

    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(profileForm);
      const payload = Object.fromEntries(formData.entries());
      localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(payload));
      profileStatus.textContent = "Profile settings updated successfully.";
    });
  }

  const sidebarToggle = root.querySelector("[data-promoter-sidebar-toggle]");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      root.classList.toggle("sidebar-open");
    });
  }

  promoterEvents.forEach(syncMarketplace);
  updatePromoterKpis();
  renderEventCards();
  renderAnalytics();
  renderPayoutHistory();
  setWizardStep(1);
}

function setupAdminDashboard() {
  const dashboardRoot = document.querySelector("#admin-dashboard");
  if (!dashboardRoot) return;

  const revenueSeries = {
    week: [6200, 7100, 6800, 7900, 8200, 9100, 9650],
    month: [5200, 5600, 6100, 6400, 7000, 7600, 7800, 8200, 8500, 9000, 9400, 9700],
    quarter: [4800, 5100, 5400, 5900, 6200, 6700, 7200, 7600, 8100, 8500, 8900, 9400]
  };

  const ticketByDay = [76, 84, 92, 88, 101, 117, 130];

  const approvals = {
    promoter: 0,
    event: 0
  };

  function countPendingApprovals() {
    const pendingPromoters = dashboardRoot.querySelectorAll('[data-kind="promoter"].is-pending').length;
    const pendingEvents = dashboardRoot.querySelectorAll('[data-kind="event"].is-pending').length;
    approvals.promoter = pendingPromoters;
    approvals.event = pendingEvents;
    return pendingPromoters + pendingEvents;
  }

  function updateKpis() {
    const events = getAllEvents();
    const activeEvents = events.length;
    const revenueAll = 1845320;
    const revenueToday = 12840;
    const revenueMonth = 248930;
    const ticketsToday = 512;
    const ticketsMonth = 14328;
    const newPromoters = 46;
    const pendingTotal = countPendingApprovals();

    const byKpi = {
      "revenue-all": usd(revenueAll),
      "tickets-month": ticketsMonth.toLocaleString(),
      "active-events": activeEvents.toLocaleString(),
      "new-promoters": newPromoters.toLocaleString(),
      "pending-approvals": pendingTotal.toLocaleString()
    };

    Object.entries(byKpi).forEach(([key, value]) => {
      const el = dashboardRoot.querySelector(`[data-kpi="${key}"]`);
      if (el) el.textContent = value;
    });

    const revenueSplit = dashboardRoot.querySelector('[data-kpi-detail="revenue-split"]');
    if (revenueSplit) revenueSplit.textContent = `Today ${usd(revenueToday)} • Month ${usd(revenueMonth)}`;

    const ticketSplit = dashboardRoot.querySelector('[data-kpi-detail="tickets-split"]');
    if (ticketSplit) ticketSplit.textContent = `Today ${ticketsToday.toLocaleString()} • This month ${ticketsMonth.toLocaleString()}`;

    const pendingBreakdown = dashboardRoot.querySelector('[data-kpi-detail="pending-breakdown"]');
    if (pendingBreakdown) pendingBreakdown.textContent = `Promoters ${approvals.promoter} • Events ${approvals.event}`;
  }

  function renderSalesSnapshot() {
    const target = dashboardRoot.querySelector("#sales-snapshot-body");
    if (!target) return;
    const rows = getAllEvents().slice(0, 6).map((event, index) => {
      const sold = 180 + index * 42;
      const gross = sold * event.price;
      const sellThrough = Math.min(98, Math.round((sold / (event.capacity || 400)) * 100));
      return `
        <tr>
          <td>${event.title}</td>
          <td>${sold.toLocaleString()}</td>
          <td>${usd(gross)}</td>
          <td>${sellThrough}%</td>
        </tr>
      `;
    });
    target.innerHTML = rows.join("");
  }

  function renderBarList(targetId, mapData) {
    const target = dashboardRoot.querySelector(targetId);
    if (!target) return;
    const sorted = Object.entries(mapData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const top = sorted[0]?.[1] || 1;
    target.innerHTML = sorted.map(([label, value]) => {
      const width = Math.max(12, Math.round((value / top) * 100));
      return `
        <div class="bar-item">
          <div class="bar-item-head"><span>${label}</span><strong>${value}</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        </div>
      `;
    }).join("");
  }

  function renderTopBreakdowns() {
    const events = getAllEvents();
    const categoryCounts = {};
    const cityCounts = {};
    events.forEach((event) => {
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
      cityCounts[event.city] = (cityCounts[event.city] || 0) + 1;
    });
    renderBarList("#top-categories", categoryCounts);
    renderBarList("#top-cities", cityCounts);
  }

  function renderTicketSalesBars() {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const mapData = Object.fromEntries(labels.map((label, i) => [label, ticketByDay[i]]));
    renderBarList("#ticket-sales-bars", mapData);
  }

  function drawRevenueChart(range = "week") {
    const canvas = dashboardRoot.querySelector("#revenue-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const values = revenueSeries[range] || revenueSeries.week;
    const width = canvas.width;
    const height = canvas.height;
    const padX = 44;
    const padY = 24;
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = Math.max(1, max - min);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "#f3d6bf";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padY + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
    }

    const points = values.map((value, i) => {
      const x = padX + (i / (values.length - 1 || 1)) * plotWidth;
      const y = padY + ((max - value) / span) * plotHeight;
      return { x, y, value };
    });

    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ea580c";
      ctx.fill();
    });

    ctx.fillStyle = "#8b5f46";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`$${min.toLocaleString()}`, 6, height - 8);
    ctx.fillText(`$${max.toLocaleString()}`, 6, 16);
  }

  function getNowStamp() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const activityFeed = dashboardRoot.querySelector("#admin-activity-feed");
  function addActivity(message) {
    if (!activityFeed) return;
    const item = document.createElement("li");
    item.innerHTML = `<small>${getNowStamp()}</small>${message}`;
    activityFeed.prepend(item);
    while (activityFeed.children.length > 8) {
      activityFeed.removeChild(activityFeed.lastElementChild);
    }
  }

  function seedActivity() {
    [
      "New promoter submitted: Neon Mesa Events",
      "Payout batch created for 2 promoters",
      "Support case DSP-3024 moved to Open",
      "Event flagged for review: Flash Ticket Drop",
      "Revenue threshold exceeded for daily target"
    ].reverse().forEach((entry) => addActivity(entry));
  }

  function setApprovalState(row, state) {
    const statusEl = row.querySelector("[data-status]");
    if (!statusEl) return;
    row.classList.remove("is-pending", "is-flagged");
    statusEl.className = "status-pill";
    if (state === "approved") {
      statusEl.classList.add("approved");
      statusEl.textContent = "Approved";
    } else {
      statusEl.classList.add("rejected");
      statusEl.textContent = "Rejected";
    }

    const actions = row.querySelectorAll("[data-approval-action]");
    actions.forEach((button) => {
      button.disabled = true;
      button.style.opacity = "0.5";
      button.style.pointerEvents = "none";
    });

    const kind = row.dataset.kind || "item";
    const label = row.children[0]?.textContent?.trim() || "Unknown";
    addActivity(`${kind === "event" ? "Event" : "Promoter"} ${state}: ${label}`);
    updateKpis();
  }

  function setupApprovalActions() {
    const rows = dashboardRoot.querySelectorAll("[data-approval-row]");
    rows.forEach((row) => {
      const approve = row.querySelector('[data-approval-action="approve"]');
      const reject = row.querySelector('[data-approval-action="reject"]');
      if (approve) approve.addEventListener("click", () => setApprovalState(row, "approved"));
      if (reject) reject.addEventListener("click", () => setApprovalState(row, "rejected"));
    });
  }

  function exportCsv() {
    const events = getAllEvents();
    const header = ["event_id", "title", "category", "city", "state", "ticket_price"];
    const lines = events.map((event) => [
      event.id,
      `"${String(event.title).replaceAll('"', '""')}"`,
      event.category,
      event.city,
      event.state,
      event.price
    ].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booqdat-admin-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    addActivity("CSV report exported by admin");
  }

  function exportPdf() {
    addActivity("PDF summary export initiated");
    window.print();
  }

  function setupQuickActions() {
    const actions = dashboardRoot.querySelectorAll("[data-quick-action]");
    actions.forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.quickAction;
        if (action === "approve-all") {
          const rows = dashboardRoot.querySelectorAll("[data-approval-row].is-pending");
          rows.forEach((row) => setApprovalState(row, "approved"));
          addActivity("Bulk approval executed for all pending items");
        }
        if (action === "export-csv") exportCsv();
        if (action === "export-pdf") exportPdf();
      });
    });
  }

  function setupRangeSwitch() {
    const buttons = dashboardRoot.querySelectorAll("[data-revenue-range]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        drawRevenueChart(button.dataset.revenueRange);
      });
    });
  }

  function setupSidebarToggle() {
    const shell = dashboardRoot;
    const toggle = shell.querySelector("[data-admin-sidebar-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      shell.classList.toggle("sidebar-open");
    });
  }

  updateKpis();
  renderSalesSnapshot();
  renderTopBreakdowns();
  renderTicketSalesBars();
  drawRevenueChart("week");
  setupApprovalActions();
  setupQuickActions();
  setupRangeSwitch();
  setupSidebarToggle();
  seedActivity();
}

function setupMobileNav() {
  const toggle = document.querySelector("[data-mobile-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

function setupPromoterAccount() {
  const accountForm = document.querySelector("#promoter-account-form");
  const accountStatus = document.querySelector("#promoter-account-status");
  const eventForm = document.querySelector("#event-create-form");
  const output = document.querySelector("#event-link-output");
  if (!accountForm || !accountStatus || !eventForm || !output) return;
  function setAccountStatus(message, isError = false) {
    accountStatus.textContent = message;
    accountStatus.style.color = isError ? "#b3261e" : "";
  }

  function activeAuthRole() {
    return normalizeRole(readAuthSession()?.user?.role);
  }

  const existingProfile = localStorage.getItem(STORAGE_KEYS.promoter);
  if (existingProfile) {
    try {
      const parsed = JSON.parse(existingProfile);
      setAccountStatus(`Account ready: ${parsed.name} (${parsed.email})`);
    } catch {
      setAccountStatus("Promoter account saved.");
    }
  }
  const authUser = readAuthSession()?.user;
  if (authUser && hasAnyRole(authUser, ["promoter", "admin"])) {
    setAccountStatus(`Authenticated: ${authUser.name || authUser.email} (${authUser.role})`);
  }

  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(accountForm);
    const profile = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim().toLowerCase(),
      phone: String(formData.get("phone") || "").trim(),
      location: String(formData.get("location") || "").trim()
    };
    const password = String(formData.get("password") || "");

    if (!profile.name || !profile.email || !password) {
      setAccountStatus("Name, email, and password are required.", true);
      return;
    }

    const registerResponse = await apiRequest("/auth/register", {
      method: "POST",
      body: {
        name: profile.name,
        email: profile.email,
        password,
        role: "promoter"
      },
      skipAuth: true,
      includeErrorResponse: true,
      suppressAuthRedirect: true
    });

    let authResponse = registerResponse;
    if (!registerResponse?.ok) {
      if (String(registerResponse?.error || "").toLowerCase().includes("already exists")) {
        authResponse = await apiRequest("/auth/login", {
          method: "POST",
          body: { email: profile.email, password },
          skipAuth: true,
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
      }
    }

    const tokens = extractAuthTokens(authResponse);
    if (!authResponse?.ok || !tokens.accessToken || !tokens.refreshToken || !authResponse?.user) {
      setAccountStatus(authResponse?.error || "Unable to authenticate promoter account.", true);
      return;
    }
    writeAuthSession({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: authResponse.user
    });
    localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(profile));
    setAccountStatus(`Account ready: ${profile.name} (${profile.email})`);
    accountForm.reset();
  });

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!["promoter", "admin"].includes(activeAuthRole())) {
      output.classList.remove("hidden");
      output.innerHTML = "<strong>Sign in with a promoter account first.</strong> <a href=\"login.html?role=promoter\">Log in</a>";
      return;
    }
    const savedProfile = localStorage.getItem(STORAGE_KEYS.promoter);
    if (!savedProfile) {
      output.classList.remove("hidden");
      const user = readAuthSession()?.user;
      const fallbackProfile = user ? {
        name: user.name || "Promoter Account",
        email: user.email || "",
        phone: "",
        location: ""
      } : null;
      if (fallbackProfile) {
        localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(fallbackProfile));
      } else {
        output.innerHTML = "<strong>Create a promoter account first.</strong>";
        return;
      }
    }

    const formData = new FormData(eventForm);
    const raw = Object.fromEntries(formData.entries());
    const eventId = `evt-${Date.now()}`;
    const newEvent = {
      id: eventId,
      title: raw.title,
      category: raw.category,
      venue: raw.venue,
      city: raw.city,
      state: raw.state,
      date: raw.date,
      time: raw.time,
      price: Number(raw.price),
      capacity: Number(raw.capacity),
      description: raw.description,
      promoterEmail: normalizeEmail(getActivePromoterEmail())
    };

    upsertStoredEvent(newEvent);
    upsertPromoterDashboardEventFromSimple(newEvent);

    const shareLink = `${window.location.origin}${window.location.pathname.replace("promoters.html", "checkout.html")}?event=${encodeURIComponent(eventId)}`;
    output.classList.remove("hidden");
    output.innerHTML = `
      <strong>Event published successfully.</strong><br>
      Share link: <a href="${shareLink}" target="_blank" rel="noopener">${shareLink}</a><br>
      <a href="events.html">View live on event marketplace</a>
    `;
    notifyPromoterEventPublished(newEvent, shareLink);

    eventForm.reset();
  });
}

function renderCheckout() {
  const summaryEl = document.querySelector("#event-summary");
  const form = document.querySelector("#checkout-form");
  const result = document.querySelector("#purchase-result");
  if (!summaryEl || !form || !result) return;

  const url = new URL(window.location.href);
  const eventId = url.searchParams.get("event");
  const returnedOrderId = String(url.searchParams.get("order") || "").trim();
  const nyvapayStatus = String(url.searchParams.get("nyvapay") || "").trim().toLowerCase();
  const event = getAllEvents().find((item) => item.id === eventId) || getAllEvents()[0];
  if (!event) return;

  summaryEl.innerHTML = `
    <h2>${event.title}</h2>
    <p><strong>Date:</strong> ${formatDate(event.date)} at ${formatTime(event.time)}</p>
    <p><strong>Venue:</strong> ${event.venue}, ${event.city}, ${event.state}</p>
    <p><strong>Ticket Price:</strong> ${usd(event.price)}</p>
    <p>${event.description || "Event details available after purchase confirmation."}</p>
  `;
  const submitButton = form.querySelector("button[type='submit']");
  const defaultSubmitLabel = submitButton?.textContent || "Complete Purchase";

  function setSubmitInFlight(isInFlight) {
    if (!submitButton) return;
    submitButton.disabled = isInFlight;
    submitButton.textContent = isInFlight ? "Redirecting to NYVAPAY..." : defaultSubmitLabel;
  }

  if (nyvapayStatus === "success" && returnedOrderId) {
    const returnEmail = String(url.searchParams.get("email") || "").trim().toLowerCase();
    const portalLink = returnEmail
      ? `user-portal.html?email=${encodeURIComponent(returnEmail)}`
      : "user-portal.html";
    result.classList.remove("hidden");
    result.innerHTML = `
      <h3>Payment Submitted</h3>
      <p><strong>Order ID:</strong> ${returnedOrderId}</p>
      <p>Your payment was submitted to NYVAPAY. We will confirm your ticket as soon as payment settlement is received.</p>
      <p><a href="${portalLink}">Open My Tickets in User Portal</a></p>
    `;
  }

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    if (submitButton?.disabled) return;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const quantity = Math.max(1, Number(payload.quantity || 1));
    const subtotal = quantity * event.price;
    const fee = Math.round(subtotal * 0.08);
    const total = subtotal + fee;
    const ticketToken = `BQD-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const authUser = readAuthSession()?.user;
    const role = normalizeRole(authUser?.role);
    const normalizedEmail = role === "user"
      ? String(authUser?.email || "").trim().toLowerCase()
      : String(payload.email || "").trim().toLowerCase();
    const attendeeName = String(payload.name || authUser?.name || "").trim();
    const attendeePhone = String(payload.phone || "").trim();

    if (!attendeeName || !normalizedEmail) {
      result.classList.remove("hidden");
      result.innerHTML = "<p>Valid attendee name and email are required.</p>";
      return;
    }
    const orderId = `ord-${Date.now()}`;
    const pendingOrder = {
      id: orderId,
      eventId: event.id,
      promoterEmail: normalizeEmail(event.promoterEmail || ""),
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      city: event.city,
      state: event.state,
      attendee: {
        name: attendeeName,
        email: normalizedEmail,
        phone: attendeePhone
      },
      ticketType: "General Admission",
      quantity,
      subtotal,
      fee,
      total,
      currency: "USD",
      status: "Pending Payment",
      paymentStatus: "Initiated",
      paymentProvider: "NYVAPAY",
      purchaseDate: new Date().toISOString(),
      ticketToken
    };

    const successRedirectUrl = `${window.location.origin}/checkout.html?event=${encodeURIComponent(event.id)}&order=${encodeURIComponent(orderId)}&email=${encodeURIComponent(normalizedEmail)}&nyvapay=success`;
    setSubmitInFlight(true);
    const paymentResponse = await apiRequest("/payments/nyvapay/payment-link", {
      method: "POST",
      body: {
        order: pendingOrder,
        successRedirectUrl
      },
      skipAuth: true,
      suppressAuthRedirect: true,
      includeErrorResponse: true
    });
    setSubmitInFlight(false);

    if (!paymentResponse?.ok || !paymentResponse?.paymentUrl) {
      result.classList.remove("hidden");
      result.innerHTML = `<p>${paymentResponse?.error || "Unable to start NYVAPAY checkout right now. Please try again."}</p>`;
      return;
    }

    const orderRecord = paymentResponse.order && typeof paymentResponse.order === "object"
      ? paymentResponse.order
      : pendingOrder;
    upsertBuyerOrder(orderRecord);

    const profileStore = readUserProfiles();
    profileStore[normalizedEmail] = {
      name: orderRecord.attendee.name,
      email: normalizedEmail,
      phone: orderRecord.attendee.phone,
      reminders: true,
      promotions: false
    };
    writeUserProfiles(profileStore);
    writeUserPortalSession({ email: normalizedEmail });
    const portalLink = `user-portal.html?email=${encodeURIComponent(normalizedEmail)}`;

    result.classList.remove("hidden");
    result.innerHTML = `
      <h3>Redirecting to NYVAPAY</h3>
      <p><strong>Attendee:</strong> ${orderRecord.attendee.name}</p>
      <p><strong>Email:</strong> ${normalizedEmail}</p>
      <p><strong>Order Total:</strong> ${usd(total)} (${quantity} ticket${quantity > 1 ? "s" : ""})</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><a href="${paymentResponse.paymentUrl}" target="_self" rel="noopener">Continue to secure payment</a></p>
      <p><a href="${portalLink}">Open My Tickets in User Portal</a></p>
    `;
    window.location.href = paymentResponse.paymentUrl;
  });
}

async function initializeClientApp() {
  const hasAccess = await enforceRoleGuardForCurrentPage();
  if (!hasAccess) return;
  await hydrateStateFromApi();
  setYear();
  setupMobileNav();
  setupAuthPage();
  renderFeaturedEvents();
  renderBrowseEvents();
  setupPromoterAccount();
  renderCheckout();
  setupUserPortal();
  setupAdminDashboard();
  setupPromoterDashboard();
}

initializeClientApp();
