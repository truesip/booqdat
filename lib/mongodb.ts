import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "booqdat";

type MongoGlobal = typeof globalThis & {
  _booqdatMongoClient?: MongoClient;
  _booqdatMongoPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as MongoGlobal;

export async function getMongoClient(): Promise<MongoClient> {
  if (globalForMongo._booqdatMongoClient) {
    return globalForMongo._booqdatMongoClient;
  }

  if (!globalForMongo._booqdatMongoPromise) {
    globalForMongo._booqdatMongoPromise = new MongoClient(uri).connect();
  }

  globalForMongo._booqdatMongoClient = await globalForMongo._booqdatMongoPromise;
  return globalForMongo._booqdatMongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

export const collections = {
  users: "users",
  profiles: "customer_profiles",
  passwordResetTokens: "password_reset_tokens",
  flightSearches: "flight_searches",
  offerSnapshots: "flight_offer_snapshots",
  bookings: "bookings",
  payments: "payments",
  paymentMethods: "payment_methods",
  passengers: "passengers",
  webhookEvents: "webhook_events",
  waitlistLeads: "waitlist_leads"
} as const;
