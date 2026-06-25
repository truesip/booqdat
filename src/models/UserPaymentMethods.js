const mongoose = require("mongoose");

const userPaymentMethodsSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    methods: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserPaymentMethods", userPaymentMethodsSchema);
