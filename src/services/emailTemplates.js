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

function promoterPendingApprovalTemplate({ companyName, name, supportEmail, dashboardUrl }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safeName = escapeHtml(name || "there");
  const safeSupportEmail = escapeHtml(supportEmail || "");
  const safeDashboardUrl = escapeHtml(dashboardUrl || "");
  return {
    subject: `${safeCompany}: Promoter application received`,
    text: [
      `Hi ${safe(name || "there")},`,
      "",
      `Thanks for registering as a promoter on ${safe(companyName || "BOOQDAT")}.`,
      "Your account is currently pending admin approval.",
      safeDashboardUrl ? `Dashboard: ${safe(dashboardUrl)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${safeName}</strong>,</p>
      <p>Thanks for registering as a promoter on <strong>${safeCompany}</strong>.</p>
      <p>Your account is currently <strong>Pending Approval</strong>.</p>
      ${safeDashboardUrl ? `<p><a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open dashboard</a></p>` : ""}
      ${safeSupportEmail ? `<p>Need help? <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function promoterStatusUpdateTemplate({ companyName, name, status, supportEmail, dashboardUrl, wasReactivated }) {
  const normalized = safe(status).toLowerCase();
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safeName = escapeHtml(name || "there");
  const safeSupportEmail = escapeHtml(supportEmail || "");
  const safeDashboardUrl = escapeHtml(dashboardUrl || "");
  let statusLabel = "Pending";
  let message = "Your promoter account is pending admin review.";
  if (normalized === "approved") {
    statusLabel = wasReactivated ? "Reactivated" : "Approved";
    message = wasReactivated
      ? "Your promoter account has been reactivated and access is restored."
      : "Your promoter account has been approved and is ready to use.";
  } else if (normalized === "rejected") {
    statusLabel = "Rejected";
    message = "Your promoter account request was rejected. Contact support for next steps.";
  } else if (normalized === "suspended") {
    statusLabel = "Suspended";
    message = "Your promoter account has been suspended. Contact support to restore access.";
  }
  return {
    subject: `${safeCompany}: Promoter account ${statusLabel}`,
    text: [
      `Hi ${safe(name || "there")},`,
      "",
      message,
      safeDashboardUrl ? `Dashboard: ${safe(dashboardUrl)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${safeName}</strong>,</p>
      <p>${escapeHtml(message)}</p>
      ${safeDashboardUrl ? `<p><a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open dashboard</a></p>` : ""}
      ${safeSupportEmail ? `<p>Support: <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function eventModerationUpdateTemplate({ companyName, promoterName, event, status, supportEmail, dashboardUrl, shareLink }) {
  const normalized = safe(status).toLowerCase();
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safePromoter = escapeHtml(promoterName || "Promoter");
  const safeTitle = escapeHtml(event?.title || "Your event");
  const safeEventId = escapeHtml(event?.id || event?.eventId || "");
  const safeSupportEmail = escapeHtml(supportEmail || "");
  const safeDashboardUrl = escapeHtml(dashboardUrl || "");
  const safeShareLink = escapeHtml(shareLink || "");
  let label = "Updated";
  let message = "Your event status has been updated.";
  if (normalized === "live" || normalized === "approved") {
    label = "Approved";
    message = "Your event was approved and is now live.";
  } else if (normalized.includes("reject")) {
    label = "Rejected";
    message = "Your event was rejected. Please update details and resubmit.";
  } else if (normalized.includes("flag")) {
    label = "Flagged";
    message = "Your event was flagged for review.";
  }
  return {
    subject: `${safeCompany}: Event ${label} - ${safeTitle}`,
    text: [
      `Hi ${safe(promoterName || "Promoter")},`,
      "",
      message,
      `Event: ${safe(event?.title || "")}`,
      safe(event?.id || event?.eventId || "") ? `Event ID: ${safe(event?.id || event?.eventId || "")}` : "",
      safeDashboardUrl ? `Dashboard: ${safe(dashboardUrl)}` : "",
      safeShareLink ? `Share Link: ${safe(shareLink)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${safePromoter}</strong>,</p>
      <p>${escapeHtml(message)}</p>
      <ul>
        <li><strong>Event:</strong> ${safeTitle}</li>
        ${safeEventId ? `<li><strong>Event ID:</strong> ${safeEventId}</li>` : ""}
      </ul>
      ${safeDashboardUrl ? `<p><a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open dashboard</a></p>` : ""}
      ${safeShareLink ? `<p><a href="${safeShareLink}" target="_blank" rel="noopener">Open share link</a></p>` : ""}
      ${safeSupportEmail ? `<p>Support: <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function orderLifecycleUpdateTemplate({ companyName, order, stage, supportEmail, portalUrl, recipientEmail }) {
  const normalizedStage = safe(stage).toLowerCase();
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const attendeeName = escapeHtml(order?.attendee?.name || "there");
  const orderId = escapeHtml(order?.id || "");
  const eventTitle = escapeHtml(order?.eventTitle || "Event");
  const safeSupportEmail = escapeHtml(supportEmail || "");
  const safePortalUrl = escapeHtml(portalUrl || "");
  const safeRecipientEmail = escapeHtml(recipientEmail || "");
  let stageLabel = "Order Update";
  let message = "Your order has been updated.";
  if (normalizedStage === "refund-requested") {
    stageLabel = "Refund Requested";
    message = "Your refund request has been submitted and is pending review.";
  } else if (normalizedStage === "transfer-requested") {
    stageLabel = "Transfer Requested";
    message = "Your transfer request has been submitted and is pending review.";
  } else if (normalizedStage === "refund-approved") {
    stageLabel = "Refund Approved";
    message = "Your refund request has been approved.";
  } else if (normalizedStage === "refund-rejected") {
    stageLabel = "Refund Rejected";
    message = "Your refund request has been rejected.";
  } else if (normalizedStage === "transfer-completed") {
    stageLabel = "Transfer Completed";
    message = "Your ticket transfer request was completed successfully.";
  } else if (normalizedStage === "transfer-rejected") {
    stageLabel = "Transfer Rejected";
    message = "Your ticket transfer request was rejected.";
  }

  return {
    subject: `${safeCompany}: ${stageLabel} (${eventTitle})`,
    text: [
      `Hi ${safe(order?.attendee?.name || "there")},`,
      "",
      message,
      `Order ID: ${safe(order?.id || "")}`,
      `Event: ${safe(order?.eventTitle || "")}`,
      safeRecipientEmail ? `Recipient: ${safe(recipientEmail)}` : "",
      safePortalUrl ? `Portal: ${safe(portalUrl)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${attendeeName}</strong>,</p>
      <p>${escapeHtml(message)}</p>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Event:</strong> ${eventTitle}</li>
        ${safeRecipientEmail ? `<li><strong>Recipient:</strong> ${safeRecipientEmail}</li>` : ""}
      </ul>
      ${safePortalUrl ? `<p><a href="${safePortalUrl}" target="_blank" rel="noopener">Open user portal</a></p>` : ""}
      ${safeSupportEmail ? `<p>Support: <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function payoutProcessedTemplate({ companyName, promoterName, order, supportEmail, dashboardUrl }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safePromoter = escapeHtml(promoterName || "Promoter");
  const safeSupportEmail = escapeHtml(supportEmail || "");
  const safeDashboardUrl = escapeHtml(dashboardUrl || "");
  const orderId = escapeHtml(order?.id || "");
  const eventTitle = escapeHtml(order?.eventTitle || "Event");
  const amount = usd(order?.total);
  return {
    subject: `${safeCompany}: Payout Processed (${eventTitle})`,
    text: [
      `Hi ${safe(promoterName || "Promoter")},`,
      "",
      "Your payout has been marked as processed.",
      `Order ID: ${safe(order?.id || "")}`,
      `Event: ${safe(order?.eventTitle || "")}`,
      `Amount: ${amount}`,
      safeDashboardUrl ? `Dashboard: ${safe(dashboardUrl)}` : "",
      safeSupportEmail ? `Support: ${safe(supportEmail)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hi <strong>${safePromoter}</strong>,</p>
      <p>Your payout has been marked as processed.</p>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Event:</strong> ${eventTitle}</li>
        <li><strong>Amount:</strong> ${escapeHtml(amount)}</li>
      </ul>
      ${safeDashboardUrl ? `<p><a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open dashboard</a></p>` : ""}
      ${safeSupportEmail ? `<p>Support: <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>` : ""}
    `
  };
}

function adminQueueAlertTemplate({ companyName, queueType, entityName, entityId, submittedBy, adminUrl }) {
  const safeCompany = escapeHtml(companyName || "BOOQDAT");
  const safeQueueType = escapeHtml(queueType || "Queue");
  const safeEntityName = escapeHtml(entityName || "Record");
  const safeEntityId = escapeHtml(entityId || "");
  const safeSubmittedBy = escapeHtml(submittedBy || "");
  const safeAdminUrl = escapeHtml(adminUrl || "");
  return {
    subject: `${safeCompany}: New ${safeQueueType} Queue Item`,
    text: [
      `A new ${safe(queueType || "queue")} item requires review.`,
      `Name: ${safe(entityName || "")}`,
      safe(entityId || "") ? `ID: ${safe(entityId)}` : "",
      safe(submittedBy || "") ? `Submitted by: ${safe(submittedBy)}` : "",
      safe(adminUrl || "") ? `Admin Queue: ${safe(adminUrl)}` : ""
    ].filter(Boolean).join("\n"),
    html: `
      <p>A new <strong>${safeQueueType}</strong> queue item requires review.</p>
      <ul>
        <li><strong>Name:</strong> ${safeEntityName}</li>
        ${safeEntityId ? `<li><strong>ID:</strong> ${safeEntityId}</li>` : ""}
        ${safeSubmittedBy ? `<li><strong>Submitted by:</strong> ${safeSubmittedBy}</li>` : ""}
      </ul>
      ${safeAdminUrl ? `<p><a href="${safeAdminUrl}" target="_blank" rel="noopener">Open admin queue</a></p>` : ""}
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
  promoterEventPublishedTemplate,
  promoterPendingApprovalTemplate,
  promoterStatusUpdateTemplate,
  eventModerationUpdateTemplate,
  orderLifecycleUpdateTemplate,
  payoutProcessedTemplate,
  adminQueueAlertTemplate
};
