const mongoose = require("mongoose");

const accessTokenBlocklistSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "UserAccount", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    reason: { type: String, default: "logout" }
  },
  { timestamps: true }
);

accessTokenBlocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AccessTokenBlocklist", accessTokenBlocklistSchema);
