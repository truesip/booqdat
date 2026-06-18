import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2).max(100).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const profileSchema = z.object({
  fullName: z.string().min(2).max(100).optional().or(z.literal("")),
  addressLine1: z.string().max(120).optional().or(z.literal("")),
  addressLine2: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(80).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  email: z.string().email()
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email()
});

export const passwordResetSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const flightSearchSchema = z.object({
  tripType: z.enum(["one-way", "round-trip"]).default("round-trip"),
  origin: z.string().min(3).max(3).transform((value) => value.toUpperCase()),
  destination: z.string().min(3).max(3).transform((value) => value.toUpperCase()),
  departureDate: z.string().min(8),
  returnDate: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).default("economy")
});

export const passengerSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["adult", "child", "infant"]).default("adult"),
  title: z.string().optional(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  bornOn: z.string().min(8),
  gender: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional()
});

export const createBookingSchema = z.object({
  offer: z.any(),
  passengers: z.array(passengerSchema).min(1),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().optional()
  })
});

export const waitlistSchema = z.object({
  email: z.string().email(),
  vertical: z.enum(["hotels", "cars", "events"]),
  note: z.string().max(500).optional()
});
