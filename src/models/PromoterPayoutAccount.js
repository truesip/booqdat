const mongoose = require("mongoose");

const promoterPayoutAccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PromoterPayoutAccount", promoterPayoutAccountSchema);
