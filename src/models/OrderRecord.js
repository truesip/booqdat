const mongoose = require("mongoose");

const orderRecordSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    attendeeEmail: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderRecord", orderRecordSchema);
