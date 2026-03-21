function safe(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function escapeHtml(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function usd(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
}

function welcomeEmailTemplate({ companyName, name, role, dashboardUrl }) {
  const titleRole = role === "promoter" ? "Promoter" : role === "admin" ? "Admin" : "User";
  const safeName = escapeHtml(name || "there");
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safeDashboardUrl = escapeHtml(dashboardUrl || "");
  return {
    subject: `${safeCompany}: ${titleRole} account ready`,
    text: [
      `Hi ${safe(name || "there")},`,
      "",
      `Your ${safeCompany} ${titleRole.toLowerCase()} account is ready.`,
      safeDashboardUrl ? `Dashboard: ${safe(dashboardUrl)}` : "",
      "",
      "If this was not you, contact support immediately."
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${safeName}</strong>,</p>
      <p>Your <strong>${safeCompany}</strong> ${escapeHtml(titleRole.toLowerCase())} account is ready.</p>
      ${safeDashboardUrl ? `<p><a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open dashboard</a></p>` : ""}
      <p>If this was not you, contact support immediately.</p>
    `
  };
}

function ticketConfirmationTemplate({ companyName, order, portalUrl, supportEmail }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const eventTitle = escapeHtml(order?.eventTitle || "Event");
  const orderId = escapeHtml(order?.id || "");
  const attendeeName = escapeHtml(order?.attendee?.name || "Attendee");
  const attendeeEmail = escapeHtml(order?.attendee?.email || "");
  const ticketToken = escapeHtml(order?.ticketToken || "");
  const total = usd(order?.total);
  const quantity = Number(order?.quantity || 1);
  const safePortalUrl = escapeHtml(portalUrl || "");
  const safeSupportEmail = escapeHtml(supportEmail || "");

  return {
    subject: `${safeCompany} ticket confirmation: ${eventTitle}`,
    text: [
      `Hi ${safe(order?.attendee?.name || "there")},`,
      "",
      `Your purchase is confirmed for ${safe(order?.eventTitle || "event")}.`,
      `Order ID: ${safe(order?.id || "")}`,
      `Ticket Token: ${safe(order?.ticketToken || "")}`,
      `Quantity: ${quantity}`,
      `Total: ${total}`,
      safePortalUrl ? `User Portal: ${safe(portalUrl)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${attendeeName}</strong>,</p>
      <p>Your purchase is confirmed for <strong>${eventTitle}</strong>.</p>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Ticket Token:</strong> ${ticketToken}</li>
        <li><strong>Quantity:</strong> ${quantity}</li>
        <li><strong>Total:</strong> ${escapeHtml(total)}</li>
        <li><strong>Email:</strong> ${attendeeEmail}</li>
      </ul>
      ${safePortalUrl ? `<p><a href="${safePortalUrl}" target="_blank" rel="noopener">Open your portal</a></p>` : ""}
      ${safeSupportEmail ? `<p>Need help? <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function promoterSaleAlertTemplate({ companyName, order }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const eventTitle = escapeHtml(order?.eventTitle || "Event");
  const orderId = escapeHtml(order?.id || "");
  const quantity = Number(order?.quantity || 1);
  const total = usd(order?.total);
  return {
    subject: `${safeCompany} sale alert: ${eventTitle}`,
    text: [
      `A new ticket order was placed for ${safe(order?.eventTitle || "event")}.`,
      `Order ID: ${safe(order?.id || "")}`,
      `Quantity: ${quantity}`,
      `Total: ${total}`
    ].join("\n"),
    html: `
      <p>A new ticket order was placed for <strong>${eventTitle}</strong>.</p>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Quantity:</strong> ${quantity}</li>
        <li><strong>Total:</strong> ${escapeHtml(total)}</li>
      </ul>
    `
  };
}

function promoterEventPublishedTemplate({ companyName, event, shareLink }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const title = escapeHtml(event?.title || "Your event");
  const eventId = escapeHtml(event?.id || "");
  const venue = escapeHtml(event?.venue || "Venue TBA");
  const city = escapeHtml(event?.city || "");
  const state = escapeHtml(event?.state || "");
  const date = escapeHtml(event?.date || "");
  const safeShareLink = escapeHtml(shareLink || "");
  return {
    subject: `${safeCompany} event published: ${title}`,
    text: [
      `Your event is live on ${safe(companyName || "BOOQDAT")}.`,
      `Title: ${safe(event?.title || "")}`,
      `Event ID: ${safe(event?.id || "")}`,
      `Date: ${safe(event?.date || "")}`,
      `Location: ${safe(event?.venue || "")} ${safe(event?.city || "")} ${safe(event?.state || "")}`.trim(),
      safeShareLink ? `Share link: ${safe(shareLink)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Your event is now live on <strong>${safeCompany}</strong>.</p>
      <ul>
        <li><strong>Title:</strong> ${title}</li>
        <li><strong>Event ID:</strong> ${eventId}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Location:</strong> ${venue}${city || state ? `, ${city}${state ? `, ${state}` : ""}` : ""}</li>
      </ul>
      ${safeShareLink ? `<p><a href="${safeShareLink}" target="_blank" rel="noopener">Open share link</a></p>` : ""}
    `
  };
}

module.exports = {
  welcomeEmailTemplate,
  ticketConfirmationTemplate,
  promoterSaleAlertTemplate,
  promoterEventPublishedTemplate
};
