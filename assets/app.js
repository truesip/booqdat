
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

const authRuntime = window.BOOQDATAuthRuntime;
if (!authRuntime) {
  throw new Error("Missing auth runtime module: assets/auth-runtime.js");
}
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
  "promoter-dashboard.html": ["promoter", "admin"],
  "promoter-events.html": ["promoter", "admin"],
  "promoter-create.html": ["promoter", "admin"],
  "promoter-analytics.html": ["promoter", "admin"],
  "promoter-payouts.html": ["promoter", "admin"],
  "promoter-settings.html": ["promoter", "admin"],
  "promoter-support.html": ["promoter", "admin"]
};
const ADMIN_SECTION_BY_PAGE = {
  "admin.html": "dashboard-home",
  "admin-promoters.html": "promoters-section",
  "admin-attendees.html": "attendees-section",
  "admin-events.html": "events-section",
  "admin-tickets-sales.html": "tickets-sales-section",
  "admin-payments.html": "payments-section",
  "admin-reports.html": "reports-section",
  "admin-disputes.html": "disputes-section",
  "admin-settings.html": "settings-section"
};
const PROMOTER_SECTION_BY_PAGE = {
  "promoter-dashboard.html": "promoter-home",
  "promoter-events.html": "promoter-events",
  "promoter-create.html": "promoter-create",
  "promoter-analytics.html": "promoter-analytics",
  "promoter-payouts.html": "promoter-payouts",
  "promoter-settings.html": "promoter-settings",
  "promoter-support.html": "promoter-support"
};
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

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ["admin", "promoter", "user"].includes(role) ? role : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEventTitle(value) {
  return String(value || "").trim().toLowerCase();
}

function isLegacyDemoEvent(event) {
  if (!event || typeof event !== "object") return false;
  const id = String(event.id || "").trim();
  const title = normalizeEventTitle(event.title);
  if (LEGACY_DEMO_EVENT_IDS.has(id)) return true;
  return LEGACY_DEMO_EVENT_TITLES.has(title);
}

function filterLegacyDemoEvents(events) {
  return (Array.isArray(events) ? events : []).filter((event) => !isLegacyDemoEvent(event));
}

function isLegacyDemoOrder(order) {
  if (!order || typeof order !== "object") return false;
  const eventId = String(order.eventId || "").trim();
  const eventTitle = normalizeEventTitle(order.eventTitle);
  if (LEGACY_DEMO_EVENT_IDS.has(eventId)) return true;
  return LEGACY_DEMO_EVENT_TITLES.has(eventTitle);
}

function filterLegacyDemoOrders(orders) {
  return (Array.isArray(orders) ? orders : []).filter((order) => !isLegacyDemoOrder(order));
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
  return authRuntime.readAuthSession();
}

function writeAuthSession(session) {
  return authRuntime.writeAuthSession(session);
}

function clearAuthSession() {
  return authRuntime.clearAuthSession();
}

function getAuthToken() {
  return authRuntime.getAuthToken();
}

function getRefreshToken() {
  return authRuntime.getRefreshToken();
}

function hasAnyRole(user, roles) {
  return authRuntime.hasAnyRole(user, roles);
}

function canUseApi() {
  return authRuntime.canUseApi();
}

function extractAuthTokens(payload, fallbackRefreshToken = "") {
  return authRuntime.extractAuthTokens(payload, fallbackRefreshToken);
}

async function refreshAuthSession() {
  return authRuntime.refreshAuthSession();
}

async function logoutCurrentSession() {
  return authRuntime.logoutCurrentSession();
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
  return authRuntime.apiRequest(path, options);
}

function queueApiSync(key, path, payload, delayMs = 450) {
  return authRuntime.queueApiSync(key, path, payload, delayMs);
}

let didHydrateFromApi = false;
function setLocalStorageJsonSafely(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function applyBootstrapPayloadToLocalState(data) {
  if (!data || typeof data !== "object") return;
  const role = normalizeRole(data?.auth?.role);
  const canHydrateOrderScope = role === "admin" || role === "user" || role === "promoter";
  const canHydrateProfileScope = role === "admin" || role === "user";

  if (Array.isArray(data.events)) {
    setLocalStorageJsonSafely(STORAGE_KEYS.customEvents, filterLegacyDemoEvents(data.events));
  }
  if (Array.isArray(data.promoterEvents)) {
    setLocalStorageJsonSafely(STORAGE_KEYS.promoterDashboardEvents, filterLegacyDemoEvents(data.promoterEvents));
  }
  if (canHydrateOrderScope && Array.isArray(data.orders)) {
    setLocalStorageJsonSafely(STORAGE_KEYS.buyerOrders, filterLegacyDemoOrders(data.orders));
  }
  if (canHydrateProfileScope && data.userProfiles && typeof data.userProfiles === "object") {
    setLocalStorageJsonSafely(STORAGE_KEYS.userProfiles, data.userProfiles);
  }
  if (canHydrateProfileScope && data.userPaymentMethods && typeof data.userPaymentMethods === "object") {
    setLocalStorageJsonSafely(STORAGE_KEYS.userPaymentMethods, data.userPaymentMethods);
  }
  if (canHydrateProfileScope && data.userFavorites && typeof data.userFavorites === "object") {
    setLocalStorageJsonSafely(STORAGE_KEYS.userFavorites, data.userFavorites);
  }
}

async function refreshStateFromApi() {
  if (!canUseApi()) return null;
  const data = await apiRequest("/bootstrap", { includeErrorResponse: true, suppressAuthRedirect: true });
  if (!data?.ok) return null;
  try {
    applyBootstrapPayloadToLocalState(data);
  } catch {
    // ignore hydration write errors and keep runtime functional
  }
  return data;
}
async function hydrateStateFromApi() {
  if (!canUseApi() || didHydrateFromApi) return;
  const data = await apiRequest("/bootstrap");
  if (!data) return;
  try {
    applyBootstrapPayloadToLocalState(data);
  } catch {
    // ignore hydration write errors and keep runtime functional
  }

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
    if (!Array.isArray(parsed)) return [];
    const filtered = filterLegacyDemoEvents(parsed);
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.customEvents, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

function writeStoredEvents(events) {
  const filtered = filterLegacyDemoEvents(events);
  localStorage.setItem(STORAGE_KEYS.customEvents, JSON.stringify(filtered));
  if (!filtered.length) {
    queueApiSync("events-empty", "/sync/events", { events: [] }, 150);
    return;
  }
  filtered.forEach((event) => {
    const eventId = String(event?.id || "").trim();
    if (!eventId) return;
    queueApiSync(`events-${eventId}`, "/sync/events", { events: [event] }, 150);
  });
}

function upsertStoredEvent(event) {
  const current = readStoredEvents();
  const idx = current.findIndex((item) => item.id === event.id);
  if (idx >= 0) current[idx] = event;
  else current.unshift(event);
  writeStoredEvents(current);
}

function removeStoredEventById(eventId) {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) return;
  const current = readStoredEvents();
  const existedInMarketplace = current.some((event) => String(event?.id || "").trim() === normalizedEventId);
  const next = current.filter((event) => String(event?.id || "").trim() !== normalizedEventId);
  writeStoredEvents(next);
  if (canUseApi() && existedInMarketplace) {
    queueApiSync(`events-unpublish-${normalizedEventId}`, "/sync/events", {
      events: [
        {
          id: normalizedEventId,
          status: "Pending Approval"
        }
      ]
    }, 150);
  }
}

function readPromoterDashboardEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.promoterDashboardEvents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = filterLegacyDemoEvents(parsed);
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.promoterDashboardEvents, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

function writePromoterDashboardEvents(events) {
  const filtered = filterLegacyDemoEvents(events);
  localStorage.setItem(STORAGE_KEYS.promoterDashboardEvents, JSON.stringify(filtered));
  if (!filtered.length) {
    queueApiSync("promoter-events-empty", "/sync/promoter-events", { promoterEvents: [] }, 150);
    return;
  }
  filtered.forEach((event) => {
    const eventId = String(event?.id || "").trim();
    if (!eventId) return;
    queueApiSync(`promoter-events-${eventId}`, "/sync/promoter-events", { promoterEvents: [event] }, 150);
  });
}

function readBuyerOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.buyerOrders);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = filterLegacyDemoOrders(parsed);
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.buyerOrders, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

function writeBuyerOrders(orders) {
  const filtered = filterLegacyDemoOrders(orders);
  localStorage.setItem(STORAGE_KEYS.buyerOrders, JSON.stringify(filtered));
  queueApiSync("orders", "/sync/orders", { orders: filtered });
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
  const sold = 0;
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
    country: event.country || "",
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
    status: String(event.status || "Pending Approval"),
    ticketsSold: sold,
    revenue: sold * gaPrice,
    promoterEmail: normalizeEmail(event.promoterEmail || getActivePromoterEmail()),
    createdAt: new Date().toISOString()
  };
  if (idx >= 0) current[idx] = { ...current[idx], ...mapped };
  else current.unshift(mapped);
  writePromoterDashboardEvents(current);
}
function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLifecycleStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isMarketplaceLiveEventStatus(value) {
  const status = normalizeLifecycleStatus(value);
  return status === "live" || status === "approved" || status === "active";
}

function isSettledOrderForMetrics(order) {
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

function ticketTypeAveragePrice(ticketTypes = [], fallback = 25) {
  const prices = ticketTypes
    .map((ticket) => toFiniteNumber(ticket?.price, 0))
    .filter((price) => price > 0);
  if (!prices.length) return fallback;
  return Math.min(...prices);
}

function mapPromoterEventToMarketplaceEvent(event) {
  if (!event || typeof event !== "object") return null;
  const id = String(event.id || "").trim();
  const title = String(event.title || "").trim();
  const status = String(event.status || "").trim().toLowerCase();
  if (!id || !title || !isMarketplaceLiveEventStatus(status)) return null;

  const ticketTypes = Array.isArray(event.ticketTypes) ? event.ticketTypes : [];
  const imageGallery = normalizeImageList(event.imageGallery).length
    ? normalizeImageList(event.imageGallery)
    : normalizeImageList(event.images);
  const banner = extractImageUrl(event.banner || event.bannerUrl || event.bannerURL || "");
  const price = ticketTypeAveragePrice(ticketTypes, toFiniteNumber(event.price, 0));
  const capacityFromTickets = ticketTypes.reduce((sum, ticket) => sum + toFiniteNumber(ticket?.quantity, 0), 0);
  const capacity = Math.max(1, capacityFromTickets || toFiniteNumber(event.capacity, 1));

  return {
    id,
    title,
    category: String(event.category || "Community"),
    venue: String(event.venue || "Venue TBA"),
    city: String(event.city || "Albuquerque"),
    state: String(event.state || "NM"),
    country: String(event.country || ""),
    date: String(event.date || ""),
    time: String(event.time || "19:00"),
    price,
    capacity,
    description: String(event.description || ""),
    status: "Live",
    banner,
    imageGallery,
    promoterEmail: normalizeEmail(event.promoterEmail || "")
  };
}

function getAllEvents() {
  const merged = new Map();
  readStoredEvents().forEach((event) => {
    if (!event || typeof event !== "object") return;
    if (!isMarketplaceLiveEventStatus(event?.status)) return;
    const id = String(event.id || "").trim();
    if (!id) return;
    merged.set(id, event);
  });
  readPromoterDashboardEvents().forEach((event) => {
    const mapped = mapPromoterEventToMarketplaceEvent(event);
    if (mapped?.id) merged.set(mapped.id, mapped);
  });
  return [...merged.values()].sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
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

function formatLocationLine(placeLike) {
  const city = String(placeLike?.city || "").trim();
  const state = String(placeLike?.state || "").trim();
  const country = String(placeLike?.country || "").trim();
  return [city, state, country].filter(Boolean).join(", ");
}
function extractImageUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const candidate = value.url || value.src || value.href || value.path || value.dataUrl || value.dataURL;
    return typeof candidate === "string" ? candidate.trim() : "";
  }
  return "";
}
function normalizeImageList(value) {
  const items = Array.isArray(value) ? value : [];
  const urls = [];
  items.forEach((item) => {
    const imageUrl = extractImageUrl(item);
    if (imageUrl) urls.push(imageUrl);
  });
  return urls;
}
function getEventImageUrl(event) {
  const banner = extractImageUrl(event?.banner || event?.bannerUrl || event?.bannerURL);
  if (banner) return banner;
  const gallery = normalizeImageList(event?.imageGallery);
  if (gallery.length) return gallery[0];
  const images = normalizeImageList(event?.images);
  return images[0] || "";
}

function createEventCard(event) {
  const location = formatLocationLine(event) || "Location TBA";
  const imageUrl = getEventImageUrl(event);
  return `
    <article class="event-card">
      <div class="event-banner">
        ${imageUrl ? `<img src="${imageUrl}" alt="${event.title} event banner" loading="lazy">` : ""}
        <span class="event-badge">${event.category}</span>
      </div>
      <div class="event-body">
        <h3>${event.title}</h3>
        <div class="event-meta">${formatDate(event.date)} • ${formatTime(event.time)}</div>
        <div class="event-meta">${event.venue}, ${location}</div>
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
  if (!featured.length) {
    target.innerHTML = `<article class="form-card"><h3>No events published yet</h3><p>Promoters can publish events from their dashboard. Check back soon.</p></article>`;
    return;
  }
  target.innerHTML = featured.map(createEventCard).join("");
}

function renderBrowseEvents() {
  const grid = document.querySelector("#events-grid");
  const searchInput = document.querySelector("#search-input");
  const citySelect = document.querySelector("#city-filter");
  const categorySelect = document.querySelector("#category-filter");
  if (!grid || !searchInput || !citySelect || !categorySelect) return;

  const events = getAllEvents();
  if (!events.length) {
    citySelect.innerHTML = `<option value="">All Cities</option>`;
    categorySelect.innerHTML = `<option value="">All Categories</option>`;
    grid.innerHTML = `<article class="form-card"><h3>No events available</h3><p>There are no live events right now.</p></article>`;
    return;
  }
  const cities = [...new Set(events.map((event) => event.city))].sort();
  const categories = [...new Set(events.map((event) => event.category))].sort();

  citySelect.innerHTML = `<option value="">All Cities</option>${cities.map((city) => `<option value="${city}">${city}</option>`).join("")}`;
  categorySelect.innerHTML = `<option value="">All Categories</option>${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}`;

  function draw() {
    const query = searchInput.value.trim().toLowerCase();
    const city = citySelect.value;
    const category = categorySelect.value;

    const filtered = events.filter((event) => {
      const textMatch = !query || `${event.title} ${event.venue} ${event.city} ${event.state || ""} ${event.country || ""}`.toLowerCase().includes(query);
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
  const sensitiveAuthParams = ["email", "password", "token", "accessToken", "refreshToken"];
  let strippedSensitiveParams = false;
  sensitiveAuthParams.forEach((param) => {
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    strippedSensitiveParams = true;
  });
  if (strippedSensitiveParams) {
    const nextQuery = url.searchParams.toString();
    const safeUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash || ""}`;
    window.history.replaceState({}, "", safeUrl);
  }
  const redirectPath = sanitizeRedirectPath(url.searchParams.get("redirect"));
  const requiredRole = normalizeRole(url.searchParams.get("role"));
  const isSignupPage = currentPageName() === "signup.html";
  const preferredSignupRole = ["user", "promoter"].includes(requiredRole) ? requiredRole : "";

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

  function setStatus(target, message, isError = false) {
    if (!target) return;
    target.textContent = message;
    target.style.color = isError ? "#b3261e" : "";
  }

  if (loginForm && loginForm.dataset.authGuardBound !== "1") {
    loginForm.dataset.authGuardBound = "1";
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
        email: String(formData.get("email") || "").trim().toLowerCase(),
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

      const response = await apiRequest("/auth/register", {
        method: "POST",
        body: payload,
        skipAuth: true,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
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

function setupUserPortal() {
  const root = document.querySelector("#user-portal");
  if (!root) return;

  const authGate = root.querySelector("#portal-auth-gate");
  const portalMain = root.querySelector("#portal-main");
  const loginForm = root.querySelector("#portal-login-form");
  const loginEmailInput = root.querySelector("#portal-login-email");
  const loginPasswordInput = root.querySelector("#portal-login-password");
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
  const headerLogoutButton = root.querySelector("[data-user-logout]");

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
      `LOCATION:${order.venue}, ${formatLocationLine(order)}`,
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
      : `<article class="promoter-card"><h3>No upcoming tickets</h3><p>Sign in with your user account (using your checkout email) to access tickets and order updates.</p></article>`;

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
        <p>${formatDate(event.date)} • ${formatLocationLine(event) || "Location TBA"}</p>
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
    root.classList.add("is-authenticated");
    if (authGate) authGate.classList.add("hidden");
    if (portalMain) portalMain.classList.remove("hidden");
  }

  function showAuth() {
    root.classList.remove("is-authenticated");
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

  async function loginToPortal(email, name = "") {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    activeEmail = normalized;
    const profile = readProfile(normalized);
    if (name && !profile.name) profile.name = name;
    profile.email = normalized;
    writeProfile(normalized, profile);
    writeUserPortalSession({ email: normalized });
    await refreshStateFromApi();
    showPortal();
    switchTab("tickets");
    renderAllPortalData();
  }

  async function logoutPortal() {
    activeEmail = "";
    if (accountLabel) accountLabel.textContent = "";
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

  if (headerLogoutButton) {
    headerLogoutButton.addEventListener("click", async () => {
      await logoutPortal();
      switchTab("tickets");
    });
  }

  if (loginForm && loginEmailInput && loginPasswordInput && loginForm.dataset.authGuardBound !== "1") {
    loginForm.dataset.authGuardBound = "1";
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
      const invalidCredentials = response?.errorCode === "INVALID_CREDENTIALS"
        || String(response?.error || "").toLowerCase().includes("invalid credentials");
      if (!response?.ok || !tokens.accessToken || !tokens.refreshToken || !response?.user) {
        showFeedback(
          invalidCredentials
            ? "Invalid email or password. Use your User account credentials to access this portal."
            : (response?.error || "Unable to sign in.")
        );
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
      await loginToPortal(response.user.email, response.user.name || "");
      loginPasswordInput.value = "";
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
    paymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(paymentForm);
      const provider = String(formData.get("provider") || "");
      const last4 = String(formData.get("last4") || "").replace(/\D/g, "").slice(-4);
      const exp = String(formData.get("exp") || "").trim();
      if (!provider || last4.length !== 4 || !exp) {
        paymentStatus.textContent = "Enter provider, last 4 digits, and expiration.";
        return;
      }
      const response = await apiRequest("/user/payment-methods", {
        method: "POST",
        body: { provider, last4, exp },
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      if (!response?.ok) {
        paymentStatus.textContent = response?.error || "Unable to save payment method.";
        return;
      }
      writeMethods(activeEmail, Array.isArray(response.methods) ? response.methods : []);
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
        const response = await apiRequest(`/orders/${encodeURIComponent(order.id)}/transfer-request`, {
          method: "POST",
          body: { recipientEmail: recipient },
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
        if (!response?.ok || !response?.order) {
          showFeedback(response?.error || "Unable to submit transfer request.");
          return;
        }
        upsertBuyerOrder(response.order);
        renderTickets();
        renderHistory();
        showFeedback(`Transfer requested from <strong>${order.attendee.email}</strong> to <strong>${recipient}</strong>.`);
      }

      if (action === "refund") {
        if (!canRefund(order)) {
          showFeedback(`Refund is not available for <strong>${order.eventTitle}</strong> under current policy.`);
          return;
        }
        const response = await apiRequest(`/orders/${encodeURIComponent(order.id)}/refund-request`, {
          method: "POST",
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
        if (!response?.ok || !response?.order) {
          showFeedback(response?.error || "Unable to submit refund request.");
          return;
        }
        upsertBuyerOrder(response.order);
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
      const response = await apiRequest(`/user/payment-methods/${encodeURIComponent(idx)}`, {
        method: "DELETE",
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      if (!response?.ok) {
        showFeedback(response?.error || "Unable to remove payment method right now.");
        return;
      }
      writeMethods(activeEmail, Array.isArray(response.methods) ? response.methods : []);
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
    void loginToPortal(authEmail, authSession?.user?.name || "");
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
  const promoterPageName = currentPageName();
  const activeSectionId = PROMOTER_SECTION_BY_PAGE[promoterPageName] || "promoter-home";

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
  const promoterLogoutButton = root.querySelector("[data-promoter-logout]");

  let currentStep = 1;
  let currentTab = "upcoming";
  let editingEventId = null;
  const EDIT_EVENT_STORAGE_KEY = "booqdat_promoter_edit_event_id";
  const MAX_WIZARD_IMAGE_UPLOADS = 3;
  const MAX_WIZARD_IMAGE_BYTES = 2 * 1024 * 1024;
  const wizardImagePreview = root.querySelector("#wizard-image-preview");
  let wizardPreviewObjectUrls = [];

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

  function queueEventForEditing(eventId) {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    try {
      sessionStorage.setItem(EDIT_EVENT_STORAGE_KEY, normalizedId);
    } catch {
      // ignore storage failures
    }
  }

  function consumeQueuedEditEventId() {
    try {
      const queuedId = String(sessionStorage.getItem(EDIT_EVENT_STORAGE_KEY) || "").trim();
      if (queuedId) sessionStorage.removeItem(EDIT_EVENT_STORAGE_KEY);
      return queuedId;
    } catch {
      return "";
    }
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
    const normalizedStatus = normalizeLifecycleStatus(event?.status);
    if (normalizedStatus === "draft") return "Draft";
    if (normalizedStatus === "paused") return "Paused";
    if (isMarketplaceLiveEventStatus(normalizedStatus)) return "Live";
    if (normalizedStatus.includes("reject")) return "Rejected";
    if (normalizedStatus.includes("flag")) return "Flagged";
    if (normalizedStatus.includes("pending") || normalizedStatus.includes("review") || normalizedStatus.includes("submitted")) {
      return "Pending Approval";
    }
    if (toNumber(event.ticketsSold) >= totalInventory(event)) return "Sold Out";
    if (event.date && event.date < todayKey) return "Past";
    return "Pending Approval";
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
    const imageGallery = normalizeImageList(event.imageGallery).length
      ? normalizeImageList(event.imageGallery)
      : normalizeImageList(event.images);
    const banner = extractImageUrl(event.banner || event.bannerUrl || event.bannerURL || "");
    return {
      id: event.id,
      title: event.title,
      category: event.category || "Community",
      venue: event.venue || "Venue TBA",
      city: event.city || "Albuquerque",
      state: event.state || "NM",
      country: event.country || "",
      date: event.date || dateOffset(14),
      time: event.time || "19:00",
      price: minPrice,
      capacity: totalInventory(event),
      description: event.description || "",
      status: "Live",
      banner,
      imageGallery,
      promoterEmail: normalizeEmail(event.promoterEmail || currentPromoterEmail())
    };
  }

  function syncMarketplace(event) {
    const status = eventStatus(event);
    if (status !== "Live") {
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

  function clearWizardPreviewObjectUrls() {
    wizardPreviewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    wizardPreviewObjectUrls = [];
  }

  function renderWizardImagePreview(imageUrls = []) {
    if (!wizardImagePreview) return;
    const urls = (Array.isArray(imageUrls) ? imageUrls : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean)
      .slice(0, MAX_WIZARD_IMAGE_UPLOADS);
    if (!urls.length) {
      wizardImagePreview.innerHTML = `<p class="muted">No image selected yet. Upload up to 3 images to preview them here.</p>`;
      return;
    }
    wizardImagePreview.innerHTML = `
      <div class="wizard-image-grid">
        ${urls.map((url, index) => `<img src="${url}" alt="Event preview image ${index + 1}" loading="lazy">`).join("")}
      </div>
    `;
  }

  function previewFromBannerValue() {
    const bannerInput = wizardForm?.elements?.namedItem("banner");
    const bannerUrl = String(("value" in (bannerInput || {}) ? bannerInput.value : "") || "").trim();
    renderWizardImagePreview(bannerUrl ? [bannerUrl] : []);
  }

  function updateWizardImagePreviewFromUploads() {
    const imageUploads = wizardForm?.elements?.namedItem("imageUploads");
    if (!imageUploads || !("files" in imageUploads)) {
      previewFromBannerValue();
      return;
    }
    const files = Array.from(imageUploads.files || [])
      .filter((file) => String(file?.type || "").toLowerCase().startsWith("image/"))
      .slice(0, MAX_WIZARD_IMAGE_UPLOADS);
    if (!files.length) {
      clearWizardPreviewObjectUrls();
      previewFromBannerValue();
      return;
    }
    const oversized = files.find((file) => Number(file?.size || 0) > MAX_WIZARD_IMAGE_BYTES);
    if (oversized) {
      showFeedback(`"${oversized.name}" exceeds 2MB. Please upload a smaller image.`);
    }
    const validFiles = files.filter((file) => Number(file?.size || 0) <= MAX_WIZARD_IMAGE_BYTES);
    clearWizardPreviewObjectUrls();
    wizardPreviewObjectUrls = validFiles.map((file) => URL.createObjectURL(file));
    renderWizardImagePreview(wizardPreviewObjectUrls);
  }

  function canAccessPromoterEvent(event) {
    const role = normalizeRole(readAuthSession()?.user?.role);
    if (role === "admin") return true;
    const currentEmail = currentPromoterEmail();
    if (!currentEmail) return true;
    const ownerEmail = normalizeEmail(event?.promoterEmail || "");
    return !ownerEmail || ownerEmail === currentEmail;
  }

  function normalizePromoterEventRecord(event) {
    const ticketTypes = Array.isArray(event.ticketTypes) && event.ticketTypes.length
      ? event.ticketTypes
      : createDefaultTicketTypes();
    const inventory = Math.max(1, ticketTypes.reduce((sum, ticket) => sum + toNumber(ticket?.quantity), 0) || toNumber(event.capacity, 1));
    const ticketsSold = Math.min(inventory, Math.max(0, toNumber(event.ticketsSold)));
    const inferredRevenue = Math.round(ticketsSold * averagePrice({ ticketTypes }));
    return {
      ...event,
      title: String(event.title || "").trim(),
      description: String(event.description || "").trim(),
      category: String(event.category || "Community"),
      tags: Array.isArray(event.tags) ? event.tags : [],
      date: String(event.date || ""),
      time: String(event.time || "19:00"),
      venueType: String(event.venueType || "Physical"),
      venue: String(event.venue || ""),
      city: String(event.city || ""),
      state: String(event.state || ""),
      country: String(event.country || ""),
      capacity: inventory,
      ticketTypes,
      banner: extractImageUrl(event.banner || event.bannerUrl || ""),
      imageGallery: normalizeImageList(event.imageGallery).length
        ? normalizeImageList(event.imageGallery)
        : normalizeImageList(event.images),
      promoCodes: Array.isArray(event.promoCodes) ? event.promoCodes : [],
      status: String(event.status || "Pending Approval"),
      ticketsSold,
      revenue: Math.max(0, toNumber(event.revenue, inferredRevenue)),
      promoterEmail: normalizeEmail(event.promoterEmail || currentPromoterEmail()),
      createdAt: event.createdAt || new Date().toISOString()
    };
  }

  function loadPromoterEvents() {
    return readPromoterDashboardEvents()
      .filter((event) => event && typeof event === "object")
      .filter(canAccessPromoterEvent)
      .map(normalizePromoterEventRecord)
      .filter((event) => String(event.id || "").trim() && event.title);
  }

  let promoterEvents = loadPromoterEvents();

  function persistEvents() {
    writePromoterDashboardEvents(promoterEvents);
  }

  function promoterOrders() {
    const eventIds = new Set(promoterEvents.map((event) => String(event.id || "")));
    const promoterEmail = currentPromoterEmail();
    return readBuyerOrders().filter((order) => {
      if (!isSettledOrderForMetrics(order)) return false;
      const eventId = String(order?.eventId || "");
      const ownerEmail = normalizeEmail(order?.promoterEmail || "");
      if (eventId && eventIds.has(eventId)) return true;
      if (promoterEmail && ownerEmail && ownerEmail === promoterEmail) return true;
      return false;
    });
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildMonthlySeries(orders, valueSelector) {
    const now = new Date();
    const months = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      months.push(startOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
    }
    const valuesByKey = months.reduce((acc, date) => {
      acc[monthKey(date)] = 0;
      return acc;
    }, {});

    orders.forEach((order) => {
      const purchaseDate = new Date(order?.purchaseDate || "");
      if (Number.isNaN(purchaseDate.getTime())) return;
      const key = monthKey(startOfMonth(purchaseDate));
      if (!(key in valuesByKey)) return;
      valuesByKey[key] += valueSelector(order);
    });

    return months.map((date) => Math.round(valuesByKey[monthKey(date)]));
  }

  function updatePromoterKpis() {
    const orders = promoterOrders();
    const upcomingEvents = promoterEvents.filter((event) => classifyEventTab(event) === "upcoming").length;
    const ticketsSold = orders.reduce((sum, order) => sum + Math.max(1, toNumber(order?.quantity, 1)), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + Math.max(0, toNumber(order?.total, 0)), 0);
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
    const orderTotalsByEvent = promoterOrders().reduce((acc, order) => {
      const eventId = String(order?.eventId || "");
      if (!eventId) return acc;
      if (!acc[eventId]) acc[eventId] = { sold: 0, revenue: 0 };
      acc[eventId].sold += Math.max(1, toNumber(order?.quantity, 1));
      acc[eventId].revenue += Math.max(0, toNumber(order?.total, 0));
      return acc;
    }, {});
    if (!rows.length) {
      eventsList.innerHTML = `<article class="promoter-card"><h3>No events in this tab</h3><p>Create a new event or switch tabs to view existing records.</p></article>`;
      return;
    }

    eventsList.innerHTML = rows.map((event) => {
      const status = eventStatus(event);
      const statusClass = status.toLowerCase().replace(/\s+/g, "");
      const inventory = totalInventory(event);
      const soldFromOrders = toNumber(orderTotalsByEvent[event.id]?.sold, 0);
      const sold = Math.min(inventory, soldFromOrders || toNumber(event.ticketsSold));
      const soldPct = Math.min(100, Math.round((sold / inventory) * 100));
      const revenue = Math.max(0, toNumber(orderTotalsByEvent[event.id]?.revenue, 0) || computeRevenue(event));
      const canTogglePause = status === "Live" || status === "Paused";
      const pauseLabel = status === "Paused" ? "Resume Sales" : status === "Live" ? "Pause Sales" : "Not Live Yet";
      const previewImage = getEventImageUrl(event);
      return `
        <article class="promoter-event-card">
          <div class="promoter-event-image">
            ${previewImage ? `<img src="${previewImage}" alt="${event.title} banner" loading="lazy">` : ""}
          </div>
          <div class="promoter-event-head">
            <h3>${event.title}</h3>
            <span class="promoter-status-pill ${statusClass}">${status}</span>
          </div>
          <p class="promoter-meta">${formatDate(event.date)} • ${formatTime(event.time)} • ${event.venue}, ${formatLocationLine(event) || "Location TBA"}</p>
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
            <button class="btn btn-secondary" type="button" data-event-action="pause" data-event-id="${event.id}" ${canTogglePause ? "" : "disabled"}>${pauseLabel}</button>
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
      country: String(formData.get("country") || "").trim(),
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
        <li><strong>Location:</strong> ${formatLocationLine(data) || "Not set"}</li>
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
    const rows = promoterOrders()
      .filter((order) => String(order?.eventId || "") === String(event.id))
      .map((order) => [
        String(order?.id || ""),
        String(order?.attendee?.email || ""),
        String(order?.attendee?.name || ""),
        String(order?.eventTitle || event.title || ""),
        String(order?.purchaseDate || "").slice(0, 10),
        Math.max(1, toNumber(order?.quantity, 1)),
        Math.max(0, toNumber(order?.total, 0))
      ].join(","));
    const csv = ["order_id,email,name,event,purchase_date,quantity,total_usd", ...rows].join("\n");
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
    const orders = promoterOrders();
    if (!orders.length) {
      target.innerHTML = `<p class="muted">Purchase heatmap appears after ticket sales are recorded.</p>`;
      return;
    }
    const slots = [
      { label: "6a", start: 6 },
      { label: "9a", start: 9 },
      { label: "12p", start: 12 },
      { label: "3p", start: 15 },
      { label: "6p", start: 18 },
      { label: "9p", start: 21 }
    ];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const matrix = days.map(() => slots.map(() => 0));
    orders.forEach((order) => {
      const date = new Date(order?.purchaseDate || "");
      if (Number.isNaN(date.getTime())) return;
      const hour = date.getHours();
      let slotIndex = 0;
      for (let i = 0; i < slots.length; i += 1) {
        if (hour >= slots[i].start) slotIndex = i;
      }
      const dayIndex = (date.getDay() + 6) % 7;
      matrix[dayIndex][slotIndex] += Math.max(1, toNumber(order?.quantity, 1));
    });
    const maxVolume = Math.max(...matrix.flat(), 1);
    target.innerHTML = matrix
      .flatMap((row, dayIndex) => row.map((volume, slotIndex) => {
        const alpha = 0.12 + (volume / maxVolume) * 0.58;
        return `<div class="heat-cell" style="background: rgba(249, 115, 22, ${alpha});" title="${days[dayIndex]} ${slots[slotIndex].label}: ${volume} purchases">${volume}</div>`;
      }))
      .join("");
  }

  function renderReferrers() {
    if (!topReferrersBody) return;
    const orders = promoterOrders();
    if (!orders.length) {
      topReferrersBody.innerHTML = `<tr><td colspan="3">No referrer data yet.</td></tr>`;
      return;
    }
    const grouped = orders.reduce((acc, order) => {
      const source = String(order?.referrer || order?.source || "Direct / Unknown");
      if (!acc[source]) acc[source] = { visits: 0, conversions: 0 };
      acc[source].visits += 1;
      acc[source].conversions += Math.max(1, toNumber(order?.quantity, 1));
      return acc;
    }, {});
    const rows = Object.entries(grouped)
      .map(([source, metrics]) => ({ source, ...metrics }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);
    topReferrersBody.innerHTML = rows
      .map((row) => `<tr><td>${row.source}</td><td>${row.visits.toLocaleString()}</td><td>${row.conversions.toLocaleString()}</td></tr>`)
      .join("");
  }

  function renderDemographics() {
    const target = root.querySelector("#promoter-demographics");
    if (!target) return;
    const orders = promoterOrders();
    if (!orders.length) {
      target.innerHTML = `<p class="muted">Buyer segmentation appears after completed purchases.</p>`;
      return;
    }
    const buyerTotals = orders.reduce((acc, order) => {
      const email = normalizeEmail(order?.attendee?.email || "");
      if (!email) return acc;
      if (!acc[email]) acc[email] = 0;
      acc[email] += Math.max(1, toNumber(order?.quantity, 1));
      return acc;
    }, {});
    const totals = Object.values(buyerTotals);
    const buyerCount = totals.length;
    if (!buyerCount) {
      target.innerHTML = `<p class="muted">Buyer segmentation appears after completed purchases.</p>`;
      return;
    }
    const segments = {
      "1 Ticket": totals.filter((qty) => qty === 1).length,
      "2-4 Tickets": totals.filter((qty) => qty >= 2 && qty <= 4).length,
      "5+ Tickets": totals.filter((qty) => qty >= 5).length
    };
    target.innerHTML = Object.entries(segments)
      .map(([label, count]) => {
        const percent = Math.round((count / buyerCount) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-head"><span>${label}</span><strong>${percent}%</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(percent, 2)}%"></div></div>
          </div>
        `;
      })
      .join("");
  }

  function renderPayoutHistory() {
    if (!payoutHistoryBody) return;
    const orderTotalsByEvent = promoterOrders().reduce((acc, order) => {
      const eventId = String(order?.eventId || "");
      if (!eventId) return acc;
      if (!acc[eventId]) acc[eventId] = 0;
      acc[eventId] += Math.max(0, toNumber(order?.total, 0));
      return acc;
    }, {});

    const rows = promoterEvents
      .filter((event) => eventStatus(event) !== "Draft")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8)
      .map((event) => {
        const gross = Math.max(0, toNumber(orderTotalsByEvent[event.id], 0) || computeRevenue(event));
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
    payoutHistoryBody.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="5">No payout records available yet.</td></tr>`;
  }

  function renderAnalytics() {
    const salesCanvas = root.querySelector("#promoter-sales-chart");
    const revenueCanvas = root.querySelector("#promoter-revenue-chart");
    const orders = promoterOrders();
    const salesSeries = buildMonthlySeries(orders, (order) => Math.max(1, toNumber(order?.quantity, 1)));
    const revenueSeries = buildMonthlySeries(orders, (order) => Math.max(0, toNumber(order?.total, 0)));

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
    setWizardInput("country", event.country || "");
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
    setWizardInput("banner", extractImageUrl(event.banner || event.bannerUrl || ""));
    setWizardInput("promoCodes", (event.promoCodes || []).join(", "));
    const imageUploads = wizardForm?.elements?.namedItem("imageUploads");
    if (imageUploads && "value" in imageUploads) imageUploads.value = "";
    const existingImages = normalizeImageList(event.imageGallery).length
      ? normalizeImageList(event.imageGallery)
      : normalizeImageList(event.images);
    const eventBanner = extractImageUrl(event.banner || event.bannerUrl || "");
    if (!existingImages.length && eventBanner) {
      existingImages.push(eventBanner);
    }
    clearWizardPreviewObjectUrls();
    renderWizardImagePreview(existingImages);
  }

  function resetWizardState() {
    if (wizardForm) wizardForm.reset();
    editingEventId = null;
    if (wizardOutput) wizardOutput.classList.add("hidden");
    clearWizardPreviewObjectUrls();
    renderWizardImagePreview([]);
    setWizardStep(1);
  }

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read image file"));
      reader.readAsDataURL(file);
    });
  }

  async function collectWizardUploadedImages() {
    const input = wizardForm?.elements?.namedItem("imageUploads");
    if (!input || !("files" in input)) return { ok: true, images: [] };
    const files = Array.from(input.files || [])
      .filter((file) => String(file?.type || "").toLowerCase().startsWith("image/"))
      .slice(0, MAX_WIZARD_IMAGE_UPLOADS);
    for (const file of files) {
      if (Number(file.size || 0) > MAX_WIZARD_IMAGE_BYTES) {
        return {
          ok: false,
          error: `"${file.name}" exceeds 2MB. Please upload a smaller image.`
        };
      }
    }
    try {
      const images = await Promise.all(files.map((file) => readImageFileAsDataUrl(file)));
      return { ok: true, images: images.filter(Boolean) };
    } catch {
      return { ok: false, error: "Unable to process uploaded images. Please try again." };
    }
  }

  async function saveWizardEvent(asDraft) {
    for (let step = 1; step <= 4; step += 1) {
      if (!validateStep(step)) {
        setWizardStep(step);
        return;
      }
    }

    const data = collectWizardData();
    if (!data) return;
    const uploadedImagesResult = await collectWizardUploadedImages();
    if (!uploadedImagesResult.ok) {
      showFeedback(uploadedImagesResult.error);
      return;
    }
    const uploadedImages = uploadedImagesResult.images;

    const existing = promoterEvents.find((event) => event.id === editingEventId);
    const inventory = Math.max(1, data.ticketTypes.reduce((sum, ticket) => sum + toNumber(ticket.quantity), 0) || toNumber(data.capacity, 1));
    const sold = existing ? Math.min(inventory, Math.max(0, toNumber(existing.ticketsSold))) : 0;
    const revenue = existing ? Math.max(0, toNumber(existing.revenue)) : 0;
    const previousImageGallery = normalizeImageList(existing?.imageGallery).length
      ? normalizeImageList(existing?.imageGallery)
      : normalizeImageList(existing?.images);
    const imageGallery = uploadedImages.length ? uploadedImages : previousImageGallery;
    const resolvedBanner = extractImageUrl(data.banner || existing?.banner || existing?.bannerUrl || existing?.bannerURL || "");

    const finalEvent = {
      ...(existing || {}),
      ...data,
      banner: resolvedBanner,
      imageGallery,
      id: existing?.id || `evt-pr-${Date.now()}`,
      status: asDraft ? "Draft" : "Pending Approval",
      ticketsSold: sold,
      revenue,
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

    if (wizardOutput) {
      wizardOutput.classList.remove("hidden");
      wizardOutput.innerHTML = asDraft
        ? `<strong>Draft saved.</strong><br>Finish and publish when ready.`
        : `<strong>Event submitted for admin approval.</strong><br>It will go live after review.`;
    }
    showFeedback(`<strong>${finalEvent.title}</strong> ${asDraft ? "saved as draft" : "submitted for admin approval"} successfully.`);
    resetWizardState();
    if (!asDraft) {
      if (activeSectionId === "promoter-events") {
        const eventsSection = root.querySelector("#promoter-events");
        if (eventsSection) eventsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.href = "promoter-events.html";
      }
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
        if (activeSectionId !== "promoter-create") {
          queueEventForEditing(targetEvent.id);
          window.location.href = "promoter-create.html";
          return;
        }
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
        if (status === "Pending Approval" || status === "Flagged") {
          showFeedback(`<strong>${targetEvent.title}</strong> is awaiting admin review and cannot be toggled yet.`);
          return;
        }
        if (status === "Rejected") {
          showFeedback(`<strong>${targetEvent.title}</strong> was rejected. Edit and re-submit for review.`);
          return;
        }
        if (status !== "Live" && status !== "Paused") {
          showFeedback(`<strong>${targetEvent.title}</strong> is not currently live.`);
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
    wizardDraft.addEventListener("click", () => {
      void saveWizardEvent(true);
    });
  }
  if (wizardPublish) {
    wizardPublish.addEventListener("click", () => {
      void saveWizardEvent(false);
    });
  }
  const wizardImageUploads = wizardForm?.elements?.namedItem("imageUploads");
  if (wizardImageUploads && "addEventListener" in wizardImageUploads) {
    wizardImageUploads.addEventListener("change", () => {
      updateWizardImagePreviewFromUploads();
    });
  }
  const wizardBannerInput = wizardForm?.elements?.namedItem("banner");
  if (wizardBannerInput && "addEventListener" in wizardBannerInput) {
    wizardBannerInput.addEventListener("input", () => {
      const imageUploads = wizardForm?.elements?.namedItem("imageUploads");
      const hasSelectedFiles = Boolean(imageUploads && "files" in imageUploads && imageUploads.files?.length);
      if (!hasSelectedFiles) previewFromBannerValue();
    });
  }

  root.querySelectorAll("[data-scroll-create]").forEach((button) => {
    button.addEventListener("click", () => {
      if (activeSectionId !== "promoter-create") {
        window.location.href = "promoter-create.html";
        return;
      }
      const createSection = root.querySelector("#promoter-create");
      if (createSection) createSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const payoutScheduleSelect = root.querySelector("#payout-schedule-select");
  const payoutScheduleInfo = root.querySelector("#payout-schedule-info");
  function updatePayoutScheduleInfo() {
    if (!payoutScheduleSelect || !payoutScheduleInfo) return;
    payoutScheduleInfo.textContent = payoutScheduleSelect.value === "monthly"
      ? "Monthly payouts are issued on the 5th business day of each month."
      : "Weekly payouts are issued every Friday for cleared transactions.";
  }
  if (payoutScheduleSelect && payoutScheduleInfo) {
    payoutScheduleSelect.addEventListener("change", updatePayoutScheduleInfo);
    updatePayoutScheduleInfo();
  }

  const bankConnectForm = root.querySelector("#bank-connect-form");
  const bankConnectStatus = root.querySelector("#bank-connect-status");
  async function loadPayoutAccount() {
    if (!bankConnectForm || !bankConnectStatus) return;
    const response = await apiRequest("/promoter/payout-account", {
      includeErrorResponse: true,
      suppressAuthRedirect: true
    });
    if (!response?.ok || !response?.payoutAccount) return;
    const payoutAccount = response.payoutAccount;
    if (bankConnectForm.elements?.bankName) bankConnectForm.elements.bankName.value = payoutAccount.bankName || "";
    if (bankConnectForm.elements?.bankAddress) bankConnectForm.elements.bankAddress.value = payoutAccount.bankAddress || "";
    if (bankConnectForm.elements?.city) bankConnectForm.elements.city.value = payoutAccount.city || "";
    if (bankConnectForm.elements?.stateProvince) bankConnectForm.elements.stateProvince.value = payoutAccount.stateProvince || "";
    if (bankConnectForm.elements?.country) bankConnectForm.elements.country.value = payoutAccount.country || "";
    if (bankConnectForm.elements?.accountHolderName) {
      bankConnectForm.elements.accountHolderName.value = payoutAccount.accountHolderName || payoutAccount.holder || "";
    }
    if (bankConnectForm.elements?.bankAccountNumber) bankConnectForm.elements.bankAccountNumber.value = payoutAccount.bankAccountNumber || "";
    if (bankConnectForm.elements?.routingNumber) bankConnectForm.elements.routingNumber.value = payoutAccount.routingNumber || "";
    if (bankConnectForm.elements?.swiftCode) bankConnectForm.elements.swiftCode.value = payoutAccount.swiftCode || "";
    if (payoutScheduleSelect) {
      payoutScheduleSelect.value = payoutAccount.schedule === "monthly" ? "monthly" : "weekly";
      updatePayoutScheduleInfo();
    }
    bankConnectStatus.textContent = "Bank transfer details loaded.";
  }
  if (bankConnectForm && bankConnectStatus) {
    bankConnectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!bankConnectForm.reportValidity()) return;
      const formData = new FormData(bankConnectForm);
      const schedule = payoutScheduleSelect?.value === "monthly" ? "monthly" : "weekly";
      const payload = {
        bankName: String(formData.get("bankName") || "").trim(),
        bankAddress: String(formData.get("bankAddress") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        stateProvince: String(formData.get("stateProvince") || "").trim(),
        country: String(formData.get("country") || "").trim(),
        accountHolderName: String(formData.get("accountHolderName") || "").trim(),
        bankAccountNumber: String(formData.get("bankAccountNumber") || "").trim(),
        routingNumber: String(formData.get("routingNumber") || "").trim(),
        swiftCode: String(formData.get("swiftCode") || "").trim(),
        schedule
      };
      const response = await apiRequest("/promoter/payout-account", {
        method: "POST",
        body: payload,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      if (!response?.ok || !response?.payoutAccount) {
        bankConnectStatus.textContent = response?.error || "Unable to connect payout account right now.";
        return;
      }
      const payoutAccount = response.payoutAccount;
      bankConnectStatus.textContent = `Bank transfer details saved for ${payoutAccount.accountHolderName || payload.accountHolderName}.`;
      if (payoutScheduleSelect) {
        payoutScheduleSelect.value = payoutAccount.schedule === "monthly" ? "monthly" : "weekly";
        updatePayoutScheduleInfo();
      }
    });
    void loadPayoutAccount();
  }

  const profileForm = root.querySelector("#promoter-settings-form");
  const profileStatus = root.querySelector("#promoter-settings-status");
  if (profileForm && profileStatus) {
    const localProfile = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.promoter) || "{}");
      } catch {
        return {};
      }
    })();
    const authUser = readAuthSession()?.user || {};
    function applyPromoterProfile(profile) {
      if (profileForm.elements?.name) profileForm.elements.name.value = String(profile?.name || "Promoter Account");
      if (profileForm.elements?.email) profileForm.elements.email.value = String(profile?.email || "");
      if (profileForm.elements?.phone) profileForm.elements.phone.value = String(profile?.phone || "");
      if (profileForm.elements?.location) profileForm.elements.location.value = String(profile?.location || "");
      if (profileForm.elements?.notifySales) profileForm.elements.notifySales.checked = profile?.notifySales !== false;
      if (profileForm.elements?.notifyPayouts) profileForm.elements.notifyPayouts.checked = profile?.notifyPayouts !== false;
    }
    const fallbackProfile = {
      name: String(localProfile?.name || authUser?.name || "Promoter Account"),
      email: String(localProfile?.email || authUser?.email || ""),
      phone: String(localProfile?.phone || ""),
      location: String(localProfile?.location || ""),
      notifySales: localProfile?.notifySales !== false,
      notifyPayouts: localProfile?.notifyPayouts !== false
    };
    applyPromoterProfile(fallbackProfile);

    async function loadPromoterProfile() {
      const response = await apiRequest("/promoter/profile", {
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      if (!response?.ok || !response?.profile) return;
      const profile = {
        ...fallbackProfile,
        ...response.profile,
        name: String(response.profile?.name || fallbackProfile.name || "Promoter Account"),
        email: String(response.profile?.email || fallbackProfile.email || ""),
        phone: String(response.profile?.phone || ""),
        location: String(response.profile?.location || ""),
        notifySales: response.profile?.notifySales !== false,
        notifyPayouts: response.profile?.notifyPayouts !== false
      };
      localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(profile));
      applyPromoterProfile(profile);
    }

    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(profileForm);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim().toLowerCase(),
        phone: String(formData.get("phone") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        notifySales: Boolean(formData.get("notifySales")),
        notifyPayouts: Boolean(formData.get("notifyPayouts"))
      };
      const response = await apiRequest("/promoter/profile", {
        method: "POST",
        body: payload,
        includeErrorResponse: true,
        suppressAuthRedirect: true
      });
      if (!response?.ok || !response?.profile) {
        profileStatus.textContent = response?.error || "Unable to update promoter profile right now.";
        return;
      }
      const profile = {
        ...payload,
        ...response.profile,
        email: String(response.profile?.email || payload.email || "")
      };
      localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(profile));
      profileStatus.textContent = "Profile settings updated successfully.";
    });
    void loadPromoterProfile();
  }

  const sidebarToggle = root.querySelector("[data-promoter-sidebar-toggle]");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      root.classList.toggle("sidebar-open");
    });
  }

  function applyPromoterSectionView() {
    const sections = root.querySelectorAll(".promoter-main > .promoter-section");
    sections.forEach((section) => {
      section.hidden = section.id !== activeSectionId;
    });
  }

  function setActivePromoterSidebarLink() {
    const links = root.querySelectorAll(".promoter-sidebar-nav a");
    links.forEach((link) => {
      const href = String(link.getAttribute("href") || "").trim().toLowerCase();
      if (!href || href.startsWith("#")) return;
      const targetPage = href.split("/").pop();
      const isActive = targetPage === promoterPageName;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function openQueuedEventEditorIfNeeded() {
    if (activeSectionId !== "promoter-create") return;
    const queuedEventId = consumeQueuedEditEventId();
    if (!queuedEventId) return;
    const queuedEvent = promoterEvents.find((event) => String(event?.id || "").trim() === queuedEventId);
    if (!queuedEvent) return;
    editingEventId = queuedEvent.id;
    fillWizardFromEvent(queuedEvent);
    setWizardStep(1);
    if (wizardOutput) wizardOutput.classList.add("hidden");
  }

  if (promoterLogoutButton) {
    promoterLogoutButton.addEventListener("click", async () => {
      await logoutCurrentSession();
      window.location.href = "login.html?role=promoter";
    });
  }
  applyPromoterSectionView();
  setActivePromoterSidebarLink();
  openQueuedEventEditorIfNeeded();

  updatePromoterKpis();
  renderEventCards();
  renderAnalytics();
  renderPayoutHistory();
  renderWizardImagePreview([]);
  setWizardStep(1);
}

function setupAdminDashboard() {
  const dashboardRoot = document.querySelector("#admin-dashboard");
  if (!dashboardRoot) return;
  const adminPageName = currentPageName();
  const activeSectionId = ADMIN_SECTION_BY_PAGE[adminPageName] || "dashboard-home";
  const adminLogoutButton = dashboardRoot.querySelector("[data-admin-logout]");
  const promoterApprovalsBody = dashboardRoot.querySelector("#admin-promoter-approvals-body");
  const promoterPayoutDetailsBody = dashboardRoot.querySelector("#admin-promoter-payout-details-body");
  const promoterPublishedEventsBody = dashboardRoot.querySelector("#admin-promoter-published-events-body");
  const attendeeRecordsBody = dashboardRoot.querySelector("#admin-attendee-records-body");
  const pendingEventsBody = dashboardRoot.querySelector("#admin-pending-events-body");
  const payoutQueueBody = dashboardRoot.querySelector("#admin-payout-queue-body");
  const disputesBody = dashboardRoot.querySelector("#admin-disputes-body");
  const activityFeed = dashboardRoot.querySelector("#admin-activity-feed");
  const feeSettingsForm = dashboardRoot.querySelector("#admin-fee-settings-form");
  const feeSettingsStatus = dashboardRoot.querySelector("#admin-fee-settings-status");
  const ADMIN_FEE_SETTINGS_STORAGE_KEY = "booqdat_admin_fee_settings";
  const DEFAULT_ADMIN_FEE_SETTINGS = {
    platformFeePercent: 8,
    fixedProcessingFeeUsd: 2
  };
  let currentRevenueRange = "week";
  let revenueSeries = {
    week: Array(7).fill(0),
    month: Array(12).fill(0),
    quarter: Array(12).fill(0)
  };
  let ticketByDay = Array(7).fill(0);

  const approvals = {
    promoter: 0,
    event: 0
  };
  let adminFeeSettings = readAdminFeeSettings();
  let opsState = {
    promoterApprovals: [],
    promoterPayoutDetails: [],
    promoterPublishedEvents: [],
    attendeeRecords: [],
    pendingEvents: [],
    payoutQueue: [],
    disputes: [],
    counts: {
      pendingPromoters: 0,
      pendingEvents: 0
    }
  };

  function normalizeAdminFeeSettings(source) {
    const platformFeePercent = Math.max(0, Math.min(30, toFiniteNumber(source?.platformFeePercent, DEFAULT_ADMIN_FEE_SETTINGS.platformFeePercent)));
    const fixedProcessingFeeUsd = Math.max(0, Math.min(100, toFiniteNumber(source?.fixedProcessingFeeUsd, DEFAULT_ADMIN_FEE_SETTINGS.fixedProcessingFeeUsd)));
    return {
      platformFeePercent: Math.round(platformFeePercent * 100) / 100,
      fixedProcessingFeeUsd: Math.round(fixedProcessingFeeUsd * 100) / 100
    };
  }

  function readAdminFeeSettings() {
    try {
      const raw = localStorage.getItem(ADMIN_FEE_SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_ADMIN_FEE_SETTINGS };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { ...DEFAULT_ADMIN_FEE_SETTINGS };
      return normalizeAdminFeeSettings(parsed);
    } catch {
      return { ...DEFAULT_ADMIN_FEE_SETTINGS };
    }
  }

  function writeAdminFeeSettings(settings) {
    try {
      localStorage.setItem(ADMIN_FEE_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAdminFeeSettings(settings)));
    } catch {
      // ignore storage write failures and keep runtime functional
    }
  }

  function applyAdminFeeSettingsToForm() {
    if (!feeSettingsForm) return;
    if (feeSettingsForm.elements?.platformFeePercent) {
      feeSettingsForm.elements.platformFeePercent.value = String(adminFeeSettings.platformFeePercent);
    }
    if (feeSettingsForm.elements?.fixedProcessingFeeUsd) {
      feeSettingsForm.elements.fixedProcessingFeeUsd.value = String(adminFeeSettings.fixedProcessingFeeUsd);
    }
  }

  function formatAdminFeePercent(value) {
    const numeric = Math.max(0, toFiniteNumber(value, 0));
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function statusPillClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("approved") || normalized.includes("processed") || normalized.includes("paid") || normalized.includes("confirmed")) {
      return "approved";
    }
    if (normalized.includes("rejected") || normalized.includes("suspended")) {
      return "rejected";
    }
    return "pending";
  }

  function formatDateTime(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function startOfDay(input) {
    const date = new Date(input);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function quantityOf(order) {
    return Math.max(1, toFiniteNumber(order?.quantity, 1));
  }

  function revenueOf(order) {
    return Math.max(0, toFiniteNumber(order?.total, 0));
  }

  function countPendingApprovals() {
    const pendingPromotersFromRows = opsState.promoterApprovals.filter((item) => String(item?.status || "").toLowerCase().includes("pending")).length;
    const pendingPromoters = Math.max(0, toFiniteNumber(opsState.counts?.pendingPromoters, pendingPromotersFromRows));
    const pendingEvents = Math.max(0, toFiniteNumber(opsState.counts?.pendingEvents, opsState.pendingEvents.length));
    approvals.promoter = pendingPromoters;
    approvals.event = pendingEvents;
    return pendingPromoters + pendingEvents;
  }
  function deriveMetrics() {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const orders = readBuyerOrders().filter(isSettledOrderForMetrics);
    const platformFeeRate = Math.max(0, toFiniteNumber(adminFeeSettings.platformFeePercent, 0)) / 100;
    const fixedProcessingFeeUsd = Math.max(0, toFiniteNumber(adminFeeSettings.fixedProcessingFeeUsd, 0));

    const weekRevenue = Array(7).fill(0);
    const monthRevenue = Array(12).fill(0);
    const quarterRevenue = Array(12).fill(0);
    const weekdayTickets = Array(7).fill(0);

    let revenueAll = 0;
    let revenueToday = 0;
    let revenueMonth = 0;
    let ticketsToday = 0;
    let ticketsMonth = 0;
    let platformProfitAll = 0;
    let platformProfitToday = 0;
    let platformProfitMonth = 0;
    let settledOrders = 0;

    orders.forEach((order) => {
      const purchaseDate = new Date(order?.purchaseDate || "");
      if (Number.isNaN(purchaseDate.getTime())) return;
      const day = startOfDay(purchaseDate);
      const diffDays = Math.floor((today - day) / (24 * 60 * 60 * 1000));
      const diffMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
      const qty = quantityOf(order);
      const amount = revenueOf(order);
      const platformProfit = Math.max(0, (amount * platformFeeRate) + fixedProcessingFeeUsd);

      revenueAll += amount;
      platformProfitAll += platformProfit;
      settledOrders += 1;
      if (day.getTime() === today.getTime()) {
        revenueToday += amount;
        ticketsToday += qty;
        platformProfitToday += platformProfit;
      }
      if (purchaseDate >= monthStart) {
        revenueMonth += amount;
        ticketsMonth += qty;
        platformProfitMonth += platformProfit;
      }
      if (diffDays >= 0 && diffDays < 7) {
        weekRevenue[6 - diffDays] += amount;
      }
      if (diffDays >= 0 && diffDays < 84) {
        const weekIndex = 11 - Math.floor(diffDays / 7);
        monthRevenue[weekIndex] += amount;
      }
      if (diffMonths >= 0 && diffMonths < 12) {
        quarterRevenue[11 - diffMonths] += amount;
      }
      if (diffDays >= 0 && diffDays < 30) {
        const weekdayIndex = (purchaseDate.getDay() + 6) % 7;
        weekdayTickets[weekdayIndex] += qty;
      }
    });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newPromoters = opsState.promoterApprovals.filter((item) => {
      const submitted = new Date(item?.submittedAt || "");
      return !Number.isNaN(submitted.getTime()) && submitted >= thirtyDaysAgo;
    }).length;

    return {
      revenueAll,
      revenueToday,
      revenueMonth,
      platformProfitAll,
      platformProfitToday,
      platformProfitMonth,
      settledOrders,
      ticketsToday,
      ticketsMonth,
      newPromoters,
      weekRevenue: weekRevenue.map((value) => Math.round(value)),
      monthRevenue: monthRevenue.map((value) => Math.round(value)),
      quarterRevenue: quarterRevenue.map((value) => Math.round(value)),
      weekdayTickets: weekdayTickets.map((value) => Math.round(value))
    };
  }

  function renderPromoterApprovalsTable() {
    if (!promoterApprovalsBody) return;
    const rows = Array.isArray(opsState.promoterApprovals) ? opsState.promoterApprovals : [];
    if (!rows.length) {
      promoterApprovalsBody.innerHTML = `<tr><td colspan="6">No promoter approvals pending.</td></tr>`;
      return;
    }
    promoterApprovalsBody.innerHTML = rows.map((item) => {
      const status = String(item?.status || "Pending");
      const isApproved = status.toLowerCase().includes("approved");
      const isRejected = status.toLowerCase().includes("rejected");
      const accountId = String(item?.id || "").trim();
      const publishedEventsCount = Math.max(0, toFiniteNumber(item?.publishedEventsCount, 0));
      return `
        <tr>
          <td>${escapeHtml(promoterName)}<br><small>${escapeHtml(promoterEmail)}</small></td>
          <td>${escapeHtml(item?.country || item?.location || "—")}</td>
          <td>${escapeHtml(formatDateTime(item?.submittedAt))}</td>
          <td>${publishedEventsCount.toLocaleString()}</td>
          <td><span class="status-pill ${statusPillClass(status)}">${escapeHtml(status)}</span></td>
          <td>
            <div class="event-action-row">
              <button class="btn btn-secondary btn-sm" type="button" data-admin-promoter-action="approved" data-account-id="${escapeHtml(accountId)}" data-email="${escapeHtml(item?.email || "")}" ${isApproved || !accountId ? "disabled" : ""}>Approve</button>
              <button class="btn btn-secondary btn-sm" type="button" data-admin-promoter-action="rejected" data-account-id="${escapeHtml(accountId)}" data-email="${escapeHtml(item?.email || "")}" ${isRejected || !accountId ? "disabled" : ""}>Reject</button>
              <button class="btn btn-secondary btn-sm" type="button" data-admin-promoter-action="delete" data-account-id="${escapeHtml(accountId)}" data-email="${escapeHtml(item?.email || "")}" ${!accountId ? "disabled" : ""}>Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function summarizePayoutAccount(payoutAccount) {
    if (!payoutAccount || typeof payoutAccount !== "object") return "Not saved";
    const bankName = String(payoutAccount?.bankName || "").trim();
    const holder = String(payoutAccount?.accountHolderName || payoutAccount?.holder || "").trim();
    const schedule = String(payoutAccount?.schedule || "").trim().toLowerCase() === "monthly" ? "Monthly" : "Weekly";
    const accountNumber = String(payoutAccount?.bankAccountNumber || "").replace(/\s+/g, "");
    const accountSuffix = accountNumber ? `••••${accountNumber.slice(-4)}` : "";
    const parts = [bankName, holder, accountSuffix, schedule].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Saved";
  }

  function renderPromoterPayoutDetailsTable() {
    if (!promoterPayoutDetailsBody) return;
    const rows = Array.isArray(opsState.promoterPayoutDetails) ? opsState.promoterPayoutDetails : [];
    if (!rows.length) {
      promoterPayoutDetailsBody.innerHTML = `<tr><td colspan="6">No promoter payout details available yet.</td></tr>`;
      return;
    }
    promoterPayoutDetailsBody.innerHTML = rows.map((item) => {
      const payoutSummary = summarizePayoutAccount(item?.payoutAccount);
      const promoterName = item?.promoterName || item?.name || "Promoter";
      const promoterEmail = item?.promoterEmail || item?.email || "";
      const payouts = Math.max(0, toFiniteNumber(item?.payoutsCompleted, toFiniteNumber(item?.payouts, 0)));
      return `
        <tr>
          <td>${escapeHtml(item?.name || "Promoter")}<br><small>${escapeHtml(item?.email || "")}</small></td>
          <td>${escapeHtml(item?.country || "—")}</td>
          <td>${Math.max(0, toFiniteNumber(item?.ticketsSold, 0)).toLocaleString()}</td>
          <td>${usd(Math.max(0, toFiniteNumber(item?.revenue, 0)))}</td>
          <td>${usd(payouts)}</td>
          <td>${escapeHtml(payoutSummary)}</td>
        </tr>
      `;
    }).join("");
  }

  function renderPromoterPublishedEventsTable() {
    if (!promoterPublishedEventsBody) return;
    const rows = Array.isArray(opsState.promoterPublishedEvents) ? opsState.promoterPublishedEvents : [];
    if (!rows.length) {
      promoterPublishedEventsBody.innerHTML = `<tr><td colspan="4">No published promoter events yet.</td></tr>`;
      return;
    }
    promoterPublishedEventsBody.innerHTML = rows.map((item) => {
      const events = Array.isArray(item?.events) ? item.events : [];
      const eventList = events.length
        ? events.map((eventItem) => escapeHtml(eventItem?.title || eventItem?.eventId || "Untitled")).join(", ")
        : "No live events";
      const promoterName = item?.promoterName || item?.name || "Promoter";
      const promoterEmail = item?.promoterEmail || item?.email || "";
      const publishedCount = Math.max(0, toFiniteNumber(item?.publishedCount, toFiniteNumber(item?.publishedEventsCount, events.length)));
      return `
        <tr>
          <td>${escapeHtml(item?.name || "Promoter")}<br><small>${escapeHtml(item?.email || "")}</small></td>
          <td>${escapeHtml(item?.country || "—")}</td>
          <td>${publishedCount.toLocaleString()}</td>
          <td>${eventList}</td>
        </tr>
      `;
    }).join("");
  }

  function renderAttendeeRecordsTable() {
    if (!attendeeRecordsBody) return;
    const rows = Array.isArray(opsState.attendeeRecords) ? opsState.attendeeRecords : [];
    attendeeRecordsBody.innerHTML = rows.length
      ? rows.map((item) => `
          <tr>
            <td>${escapeHtml(item?.name || "Attendee")}</td>
            <td>${escapeHtml(item?.email || "—")}</td>
            <td>${Math.max(0, toFiniteNumber(item?.orders, 0)).toLocaleString()}</td>
            <td>${escapeHtml(formatDateTime(item?.lastPurchase))}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No attendee records available yet.</td></tr>`;
  }

  function renderPendingEventsTable() {
    if (!pendingEventsBody) return;
    const rows = Array.isArray(opsState.pendingEvents) ? opsState.pendingEvents : [];
    if (!rows.length) {
      pendingEventsBody.innerHTML = `<tr><td colspan="5">No pending or flagged events.</td></tr>`;
      return;
    }
    pendingEventsBody.innerHTML = rows.map((item) => {
      const status = String(item?.status || "Pending");
      const normalizedStatus = status.toLowerCase();
      return `
        <tr>
          <td>${escapeHtml(item?.title || "Untitled Event")}</td>
          <td>${escapeHtml(item?.promoterEmail || "—")}</td>
          <td>${escapeHtml(item?.category || "—")}</td>
          <td><span class="status-pill ${statusPillClass(status)}">${escapeHtml(status)}</span></td>
          <td>
            <div class="event-action-row">
              <button class="btn btn-secondary btn-sm" type="button" data-admin-event-action="Live" data-event-id="${escapeHtml(item?.eventId || "")}" ${normalizedStatus === "live" ? "disabled" : ""}>Approve</button>
              <button class="btn btn-secondary btn-sm" type="button" data-admin-event-action="Rejected" data-event-id="${escapeHtml(item?.eventId || "")}" ${normalizedStatus.includes("reject") ? "disabled" : ""}>Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderPayoutQueueTable() {
    if (!payoutQueueBody) return;
    const rows = Array.isArray(opsState.payoutQueue) ? opsState.payoutQueue : [];
    if (!rows.length) {
      payoutQueueBody.innerHTML = `<tr><td colspan="5">No payout items in queue.</td></tr>`;
      return;
    }
    payoutQueueBody.innerHTML = rows.map((item) => {
      const status = String(item?.status || "Scheduled");
      const isProcessed = status.toLowerCase().includes("processed");
      return `
        <tr>
          <td>${escapeHtml(item?.promoterName || item?.promoterEmail || "Unknown promoter")}</td>
          <td>${usd(Math.max(0, toFiniteNumber(item?.amount, 0)))}</td>
          <td>${escapeHtml(formatDateTime(item?.payoutDate))}</td>
          <td><span class="status-pill ${statusPillClass(status)}">${escapeHtml(status)}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" type="button" data-admin-payout-action="process" data-order-id="${escapeHtml(item?.orderId || "")}" ${isProcessed ? "disabled" : ""}>Mark Processed</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderDisputesTable() {
    if (!disputesBody) return;
    const rows = Array.isArray(opsState.disputes) ? opsState.disputes : [];
    if (!rows.length) {
      disputesBody.innerHTML = `<tr><td colspan="6">No open dispute cases.</td></tr>`;
      return;
    }
    disputesBody.innerHTML = rows.map((item) => `
      <tr>
        <td>${escapeHtml(item?.caseId || `DSP-${item?.orderId || ""}`)}</td>
        <td>${escapeHtml(item?.type || "Case")}</td>
        <td>${escapeHtml(item?.relatedEvent || "Unknown event")}</td>
        <td>${escapeHtml(item?.priority || "Medium")}</td>
        <td><span class="status-pill ${statusPillClass(item?.status || "Open")}">${escapeHtml(item?.status || "Open")}</span></td>
        <td>
          <div class="event-action-row">
            <button class="btn btn-secondary btn-sm" type="button" data-admin-dispute-action="approved" data-order-id="${escapeHtml(item?.orderId || "")}" data-recipient-email="${escapeHtml(item?.recipientEmail || "")}">Approve</button>
            <button class="btn btn-secondary btn-sm" type="button" data-admin-dispute-action="rejected" data-order-id="${escapeHtml(item?.orderId || "")}">Reject</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderOpsTables() {
    renderPromoterApprovalsTable();
    renderPromoterPayoutDetailsTable();
    renderPromoterPublishedEventsTable();
    renderAttendeeRecordsTable();
    renderPendingEventsTable();
    renderPayoutQueueTable();
    renderDisputesTable();
  }

  async function loadOpsDashboard() {
    const response = await apiRequest("/admin/ops/dashboard", {
      includeErrorResponse: true,
      suppressAuthRedirect: true
    });
    if (!response?.ok) return false;
    opsState = {
      promoterApprovals: Array.isArray(response.promoterApprovals) ? response.promoterApprovals : [],
      promoterPayoutDetails: Array.isArray(response.promoterPayoutDetails) ? response.promoterPayoutDetails : [],
      promoterPublishedEvents: Array.isArray(response.promoterPublishedEvents) ? response.promoterPublishedEvents : [],
      attendeeRecords: Array.isArray(response.attendeeRecords) ? response.attendeeRecords : [],
      pendingEvents: Array.isArray(response.pendingEvents) ? response.pendingEvents : [],
      payoutQueue: Array.isArray(response.payoutQueue) ? response.payoutQueue : [],
      disputes: Array.isArray(response.disputes) ? response.disputes : [],
      counts: response.counts && typeof response.counts === "object"
        ? response.counts
        : { pendingPromoters: 0, pendingEvents: 0 }
    };
    renderOpsTables();
    return true;
  }

  async function reloadAdminData() {
    await refreshStateFromApi();
    await loadOpsDashboard();
    updateKpis();
    renderSalesSnapshot();
    renderTopBreakdowns();
    renderTicketSalesBars();
    drawRevenueChart(currentRevenueRange);
  }

  function updateKpis() {
    const metrics = deriveMetrics();
    revenueSeries = {
      week: metrics.weekRevenue,
      month: metrics.monthRevenue,
      quarter: metrics.quarterRevenue
    };
    ticketByDay = metrics.weekdayTickets;
    const events = getAllEvents();
    const activeEvents = events.length;
    const pendingTotal = countPendingApprovals();

    const byKpi = {
      "revenue-all": usd(metrics.revenueAll),
      "platform-profit": usd(metrics.platformProfitAll),
      "tickets-month": metrics.ticketsMonth.toLocaleString(),
      "active-events": activeEvents.toLocaleString(),
      "new-promoters": metrics.newPromoters.toLocaleString(),
      "pending-approvals": pendingTotal.toLocaleString()
    };

    Object.entries(byKpi).forEach(([key, value]) => {
      const el = dashboardRoot.querySelector(`[data-kpi="${key}"]`);
      if (el) el.textContent = value;
    });

    const revenueSplit = dashboardRoot.querySelector('[data-kpi-detail="revenue-split"]');
    if (revenueSplit) revenueSplit.textContent = `Today ${usd(metrics.revenueToday)} • Month ${usd(metrics.revenueMonth)}`;

    const ticketSplit = dashboardRoot.querySelector('[data-kpi-detail="tickets-split"]');
    if (ticketSplit) ticketSplit.textContent = `Today ${metrics.ticketsToday.toLocaleString()} • This month ${metrics.ticketsMonth.toLocaleString()}`;

    const pendingBreakdown = dashboardRoot.querySelector('[data-kpi-detail="pending-breakdown"]');
    if (pendingBreakdown) pendingBreakdown.textContent = `Promoters ${approvals.promoter} • Events ${approvals.event}`;

    const profitModel = dashboardRoot.querySelector('[data-kpi-detail="profit-model"]');
    if (profitModel) {
      profitModel.textContent = `Model ${formatAdminFeePercent(adminFeeSettings.platformFeePercent)}% + ${usd(adminFeeSettings.fixedProcessingFeeUsd)} per settled order • Today ${usd(metrics.platformProfitToday)} • Month ${usd(metrics.platformProfitMonth)} • Orders ${metrics.settledOrders.toLocaleString()}`;
    }
  }

  function renderSalesSnapshot() {
    const target = dashboardRoot.querySelector("#sales-snapshot-body");
    if (!target) return;
    const totalsByEvent = readBuyerOrders().filter(isSettledOrderForMetrics).reduce((acc, order) => {
      const eventId = String(order?.eventId || "");
      if (!eventId) return acc;
      if (!acc[eventId]) acc[eventId] = { sold: 0, gross: 0 };
      acc[eventId].sold += quantityOf(order);
      acc[eventId].gross += revenueOf(order);
      return acc;
    }, {});
    const rows = getAllEvents()
      .map((event) => {
        const totals = totalsByEvent[event.id] || { sold: 0, gross: 0 };
        const sellThrough = Math.min(100, Math.round((totals.sold / Math.max(1, toFiniteNumber(event.capacity, 1))) * 100));
        return { event, sold: totals.sold, gross: totals.gross, sellThrough };
      })
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 6)
      .map((row) => `
        <tr>
          <td>${row.event.title}</td>
          <td>${row.sold.toLocaleString()}</td>
          <td>${usd(row.gross)}</td>
          <td>${row.sellThrough}%</td>
        </tr>
      `);
    target.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="4">No sales records available yet.</td></tr>`;
  }

  function renderBarList(targetId, mapData) {
    const target = dashboardRoot.querySelector(targetId);
    if (!target) return;
    const sorted = Object.entries(mapData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!sorted.length) {
      target.innerHTML = `<p class="muted">No data yet.</p>`;
      return;
    }
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
    const values = (revenueSeries[range] && revenueSeries[range].length ? revenueSeries[range] : revenueSeries.week) || [0];
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

  function addActivity(message) {
    if (!activityFeed) return;
    const item = document.createElement("li");
    item.innerHTML = `<small>${getNowStamp()}</small>${message}`;
    activityFeed.prepend(item);
    while (activityFeed.children.length > 8) {
      activityFeed.removeChild(activityFeed.lastElementChild);
    }
  }



  function exportCsv() {
    const events = getAllEvents();
    const totalsByEvent = readBuyerOrders().filter(isSettledOrderForMetrics).reduce((acc, order) => {
      const eventId = String(order?.eventId || "");
      if (!eventId) return acc;
      if (!acc[eventId]) acc[eventId] = { sold: 0, gross: 0 };
      acc[eventId].sold += quantityOf(order);
      acc[eventId].gross += revenueOf(order);
      return acc;
    }, {});
    const header = ["event_id", "title", "category", "city", "state", "ticket_price", "tickets_sold", "gross_usd"];
    const lines = events.map((event) => [
      event.id,
      `"${String(event.title).replaceAll('"', '""')}"`,
      event.category,
      event.city,
      event.state,
      event.price,
      toFiniteNumber(totalsByEvent[event.id]?.sold, 0),
      toFiniteNumber(totalsByEvent[event.id]?.gross, 0)
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
      button.addEventListener("click", async () => {
        const action = button.dataset.quickAction;
        if (action === "approve-all") {
          const response = await apiRequest("/admin/ops/approve-all", {
            method: "POST",
            includeErrorResponse: true,
            suppressAuthRedirect: true
          });
          if (!response?.ok) {
            addActivity(`Bulk approval failed: ${escapeHtml(response?.error || "Unknown error")}`);
            return;
          }
          addActivity(`Bulk approval executed. Promoters: ${toFiniteNumber(response.promotersApproved, 0)} • Events: ${toFiniteNumber(response.eventsApproved, 0)}`);
          await reloadAdminData();
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
        currentRevenueRange = button.dataset.revenueRange || "week";
        drawRevenueChart(currentRevenueRange);
      });
    });
  }

  function setFeeSettingsStatus(message, isError = false) {
    if (!feeSettingsStatus) return;
    feeSettingsStatus.textContent = String(message || "");
    feeSettingsStatus.style.color = isError ? "#b3261e" : "";
  }

  function setupFeeSettingsForm() {
    if (!feeSettingsForm) return;
    applyAdminFeeSettingsToForm();
    feeSettingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!feeSettingsForm.reportValidity()) return;
      const formData = new FormData(feeSettingsForm);
      const nextSettings = normalizeAdminFeeSettings({
        platformFeePercent: formData.get("platformFeePercent"),
        fixedProcessingFeeUsd: formData.get("fixedProcessingFeeUsd")
      });
      adminFeeSettings = nextSettings;
      writeAdminFeeSettings(nextSettings);
      applyAdminFeeSettingsToForm();
      updateKpis();
      setFeeSettingsStatus(`Saved: ${formatAdminFeePercent(nextSettings.platformFeePercent)}% + ${usd(nextSettings.fixedProcessingFeeUsd)} per settled order.`);
      addActivity(`Fee settings saved (${formatAdminFeePercent(nextSettings.platformFeePercent)}% + ${usd(nextSettings.fixedProcessingFeeUsd)} per settled order).`);
    });
  }

  function setupAdminTableActions() {
    dashboardRoot.addEventListener("click", async (event) => {
      const promoterActionButton = event.target.closest("[data-admin-promoter-action]");
      if (promoterActionButton) {
        const accountId = String(promoterActionButton.dataset.accountId || "").trim();
        const action = String(promoterActionButton.dataset.adminPromoterAction || "").trim().toLowerCase();
        const email = String(promoterActionButton.dataset.email || "").trim();
        if (!accountId || !action) return;
        promoterActionButton.disabled = true;
        let response;
        if (action === "delete") {
          const confirmed = window.confirm(`Delete promoter ${email || accountId}? This removes their profile, payout account, and promoter events.`);
          if (!confirmed) {
            promoterActionButton.disabled = false;
            return;
          }
          response = await apiRequest(`/admin/promoters/${encodeURIComponent(accountId)}`, {
            method: "DELETE",
            includeErrorResponse: true,
            suppressAuthRedirect: true
          });
        } else if (["approved", "rejected"].includes(action)) {
          response = await apiRequest(`/admin/promoters/${encodeURIComponent(accountId)}/status`, {
            method: "POST",
            body: { status: action },
            includeErrorResponse: true,
            suppressAuthRedirect: true
          });
        } else {
          promoterActionButton.disabled = false;
          return;
        }
        if (!response?.ok) {
          addActivity(`Promoter action failed for ${escapeHtml(email || accountId)}: ${escapeHtml(response?.error || "Unknown error")}`);
          promoterActionButton.disabled = false;
          return;
        }
        if (action === "delete") {
          addActivity(`Promoter deleted: ${escapeHtml(email || accountId)}`);
        } else {
          addActivity(`Promoter ${action === "approved" ? "approved" : "updated"}: ${escapeHtml(email || accountId)}`);
        }
        await reloadAdminData();
        return;
      }

      const eventActionButton = event.target.closest("[data-admin-event-action]");
      if (eventActionButton) {
        const eventId = String(eventActionButton.dataset.eventId || "").trim();
        const nextStatus = String(eventActionButton.dataset.adminEventAction || "").trim();
        if (!eventId || !nextStatus) return;
        eventActionButton.disabled = true;
        const response = await apiRequest(`/admin/events/${encodeURIComponent(eventId)}/status`, {
          method: "POST",
          body: { status: nextStatus },
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
        if (!response?.ok) {
          addActivity(`Event status update failed for ${escapeHtml(eventId)}: ${escapeHtml(response?.error || "Unknown error")}`);
          eventActionButton.disabled = false;
          return;
        }
        if (String(nextStatus || "").trim().toLowerCase() === "live") {
          const pendingEvent = (Array.isArray(opsState.pendingEvents) ? opsState.pendingEvents : [])
            .find((item) => String(item?.eventId || "").trim() === eventId);
          const promoterEmail = normalizeEmail(pendingEvent?.promoterEmail || "");
          if (promoterEmail) {
            notifyPromoterEventPublished(
              {
                id: eventId,
                eventId,
                title: String(pendingEvent?.title || ""),
                promoterEmail
              },
              getShareLink(eventId)
            );
          }
        }
        addActivity(`Event ${escapeHtml(eventId)} set to ${escapeHtml(nextStatus)}.`);
        await reloadAdminData();
        return;
      }

      const payoutActionButton = event.target.closest("[data-admin-payout-action='process']");
      if (payoutActionButton) {
        const orderId = String(payoutActionButton.dataset.orderId || "").trim();
        if (!orderId) return;
        payoutActionButton.disabled = true;
        const response = await apiRequest(`/admin/payouts/${encodeURIComponent(orderId)}/process`, {
          method: "POST",
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
        if (!response?.ok) {
          addActivity(`Payout processing failed for ${escapeHtml(orderId)}: ${escapeHtml(response?.error || "Unknown error")}`);
          payoutActionButton.disabled = false;
          return;
        }
        addActivity(`Payout processed for order ${escapeHtml(orderId)}.`);
        await reloadAdminData();
        return;
      }

      const disputeActionButton = event.target.closest("[data-admin-dispute-action]");
      if (disputeActionButton) {
        const orderId = String(disputeActionButton.dataset.orderId || "").trim();
        const resolution = String(disputeActionButton.dataset.adminDisputeAction || "").trim().toLowerCase();
        const recipientEmail = String(disputeActionButton.dataset.recipientEmail || "").trim();
        if (!orderId || !resolution) return;
        disputeActionButton.disabled = true;
        const body = { resolution };
        if (recipientEmail) body.recipientEmail = recipientEmail;
        const response = await apiRequest(`/admin/disputes/${encodeURIComponent(orderId)}/resolve`, {
          method: "POST",
          body,
          includeErrorResponse: true,
          suppressAuthRedirect: true
        });
        if (!response?.ok) {
          addActivity(`Dispute resolution failed for ${escapeHtml(orderId)}: ${escapeHtml(response?.error || "Unknown error")}`);
          disputeActionButton.disabled = false;
          return;
        }
        addActivity(`Dispute ${resolution === "approved" ? "approved" : "rejected"} for order ${escapeHtml(orderId)}.`);
        await reloadAdminData();
      }
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


  function applyAdminSectionView() {
    const sections = dashboardRoot.querySelectorAll(".admin-main > .admin-section");
    sections.forEach((section) => {
      section.hidden = section.id !== activeSectionId;
    });
  }

  function setActiveAdminSidebarLink() {
    const links = dashboardRoot.querySelectorAll(".admin-sidebar-nav a");
    links.forEach((link) => {
      const href = String(link.getAttribute("href") || "").trim().toLowerCase();
      if (!href || href.startsWith("#")) return;
      const targetPage = href.split("/").pop();
      const isActive = targetPage === adminPageName;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  if (adminLogoutButton) {
    adminLogoutButton.addEventListener("click", async () => {
      await logoutCurrentSession();
      window.location.href = "login.html?role=admin";
    });
  }

  applyAdminSectionView();
  setActiveAdminSidebarLink();
  setupFeeSettingsForm();
  updateKpis();
  renderSalesSnapshot();
  renderTopBreakdowns();
  renderTicketSalesBars();
  drawRevenueChart(currentRevenueRange);
  renderOpsTables();
  setupQuickActions();
  setupRangeSwitch();
  setupAdminTableActions();
  setupSidebarToggle();
  addActivity("Admin dashboard loaded.");
  void (async () => {
    const loaded = await loadOpsDashboard();
    if (loaded) {
      updateKpis();
      renderSalesSnapshot();
      renderTopBreakdowns();
      renderTicketSalesBars();
      drawRevenueChart(currentRevenueRange);
      addActivity("Operational queues synced from server.");
    }
  })();
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
    if (registerResponse?.ok && registerResponse?.requiresApproval) {
      localStorage.setItem(STORAGE_KEYS.promoter, JSON.stringify(profile));
      clearAuthSession();
      setAccountStatus(registerResponse?.message || "Promoter account created. Wait for admin approval before signing in.");
      accountForm.reset();
      return;
    }

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
      if (["PROMOTER_PENDING_APPROVAL", "PROMOTER_REJECTED", "PROMOTER_SUSPENDED"].includes(String(authResponse?.errorCode || ""))) {
        setAccountStatus(authResponse?.error || "Promoter account is not approved for sign-in yet.", true);
        return;
      }
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
      country: raw.country,
      date: raw.date,
      time: raw.time,
      price: Number(raw.price),
      capacity: Number(raw.capacity),
      description: raw.description,
      promoterEmail: normalizeEmail(getActivePromoterEmail()),
      status: "Pending Approval"
    };

    upsertPromoterDashboardEventFromSimple(newEvent);
    removeStoredEventById(eventId);
    output.classList.remove("hidden");
    output.innerHTML = `
      <strong>Event submitted for admin approval.</strong><br>
      You can edit this event in the promoter dashboard while it is under review.
    `;

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
  const events = getAllEvents();
  const event = events.find((item) => item.id === eventId) || events[0];
  if (!event) {
    summaryEl.innerHTML = `<h2>No events available</h2><p>There are no live events to purchase right now.</p>`;
    form.classList.add("hidden");
    result.classList.remove("hidden");
    result.innerHTML = `<p><a href="events.html">Browse events</a> to check for new listings.</p>`;
    return;
  }

  summaryEl.innerHTML = `
    <h2>${event.title}</h2>
    <p><strong>Date:</strong> ${formatDate(event.date)} at ${formatTime(event.time)}</p>
    <p><strong>Venue:</strong> ${event.venue}, ${formatLocationLine(event) || "Location TBA"}</p>
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
      country: event.country,
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
      const gatewayStatus = Number(paymentResponse?.gatewayStatus || 0);
      const gatewayErrorText = String(paymentResponse?.error || "");
      const isGatewayTimeout = gatewayStatus === 504
        || /(^|[^0-9])504([^0-9]|$)/.test(gatewayErrorText)
        || /timed out/i.test(gatewayErrorText);
      const isGatewayUnavailable = [502, 503].includes(gatewayStatus)
        || /(^|[^0-9])(502|503)([^0-9]|$)/.test(gatewayErrorText);
      let checkoutErrorMessage = gatewayErrorText || "Unable to start NYVAPAY checkout right now. Please try again.";
      if (isGatewayTimeout) {
        checkoutErrorMessage = "NYVAPAY took too long to respond. Please wait a few seconds and try again.";
      } else if (isGatewayUnavailable) {
        checkoutErrorMessage = "NYVAPAY is temporarily unavailable. Please try again shortly.";
      }
      result.classList.remove("hidden");
      result.innerHTML = `<p>${checkoutErrorMessage}</p>`;
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
  function revealPageAfterAuthGuard() {
    document.documentElement.classList.remove("auth-pending");
    if (document.body) document.body.classList.remove("auth-pending");
  }
  setYear();
  setupMobileNav();
  setupAuthPage();
  if (["login.html", "signup.html"].includes(currentPageName())) {
    revealPageAfterAuthGuard();
    return;
  }
  const hasAccess = await enforceRoleGuardForCurrentPage();
  if (!hasAccess) return;
  try {
    await hydrateStateFromApi();
    renderFeaturedEvents();
    renderBrowseEvents();
    setupPromoterAccount();
    renderCheckout();
    setupUserPortal();
    setupAdminDashboard();
    setupPromoterDashboard();
  } finally {
    revealPageAfterAuthGuard();
  }
}

initializeClientApp();
