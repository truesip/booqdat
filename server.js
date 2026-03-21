const { loadEnvironment } = require("./src/config/env");
const { connectToMongo } = require("./src/config/db");
const { seedPlatformAccounts } = require("./src/services/accountBootstrap");
const { createApp } = require("./src/app");

const env = loadEnvironment();
const app = createApp(env);

connectToMongo(env.mongoUri)
  .then(async () => {
    await seedPlatformAccounts(env);
    app.listen(env.port, () => {
      console.log(`BOOQDAT server running on port ${env.port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
