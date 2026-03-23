const mongoose = require("mongoose");

let isConnected = false;

async function connectToMongo(uri) {
  if (isConnected) return mongoose.connection;
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  isConnected = true;
  return mongoose.connection;
}

module.exports = { connectToMongo };
