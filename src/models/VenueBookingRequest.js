const mongoose = require("mongoose");

const venueBookingRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true, trim: true },
    venueEmail: { type: String, required: true, index: true, trim: true, lowercase: true },
    requesterEmail: { type: String, required: true, index: true, trim: true, lowercase: true },
    requesterRole: { type: String, required: true, trim: true },
    status: { type: String, required: true, default: "Pending", index: true },
    data: { type: Object, default: {} },
    actionReason: { type: String, default: "" },
    actedByEmail: { type: String, default: "", trim: true, lowercase: true },
    actedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("VenueBookingRequest", venueBookingRequestSchema);
