const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    contextLabel: { type: String, required: true },
    templateName: { type: String, required: true },
    recipientEmail: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 2 },
    nextRetryAt: { type: Date, default: null, index: true },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    providerRequestId: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
