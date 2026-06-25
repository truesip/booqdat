const mongoose = require("mongoose");

const userFavoritesSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    eventIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserFavorites", userFavoritesSchema);
