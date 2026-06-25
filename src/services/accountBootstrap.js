const bcrypt = require("bcryptjs");
const UserAccount = require("../models/UserAccount");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function seedPlatformAccounts(env) {
  const adminEmail = normalizeEmail(env.seedAdminEmail);
  const adminPassword = String(env.seedAdminPassword || "").trim();
  if (!adminEmail || !adminPassword) return;

  const existing = await UserAccount.findOne({ email: adminEmail }).lean();
  if (existing) return;

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await UserAccount.create({
    email: adminEmail,
    name: "Platform Admin",
    role: "admin",
    passwordHash,
    isActive: true
  });
  console.log(`Seeded admin account: ${adminEmail}`);
}

module.exports = { seedPlatformAccounts };
