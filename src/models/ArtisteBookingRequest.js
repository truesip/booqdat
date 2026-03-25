const mongoose = require("mongoose");

const artisteBookingRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true, trim: true },
    artisteEmail: { type: String, required: true, index: true, trim: true, lowercase: true },
    promoterEmail: { type: String, required: true, index: true, trim: true, lowercase: true },
    status: { type: String, required: true, default: "Pending", index: true },
    data: { type: Object, default: {} },
    actionReason: { type: String, default: "" },
    actedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ArtisteBookingRequest", artisteBookingRequestSchema);
