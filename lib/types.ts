import type { ObjectId } from "mongodb";

export type UserRole = "customer" | "admin";

export type BookingStatus =
  | "draft"
  | "pending_payment"
  | "payment_succeeded"
  | "ticketing_in_progress"
  | "confirmed"
  | "payment_failed"
  | "ticketing_failed"
  | "requires_manual_review"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "created" | "pending" | "succeeded" | "failed" | "refunded";

export type Vertical = "hotels" | "cars" | "events";

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  passwordHash?: string;
  role: UserRole;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerProfileDocument {
  _id?: ObjectId;
  userId: ObjectId;
  fullName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  dateOfBirth?: string;
  contactPreferences?: {
    dealsEmail?: boolean;
    bookingUpdatesSms?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedFlightOffer {
  id: string;
  expiresAt?: string;
  totalAmount: string;
  totalCurrency: string;
  baseAmount?: string;
  taxAmount?: string;
  ownerName: string;
  ownerIataCode?: string;
  totalEmissionsKg?: string | null;
  slices: Array<{
    originCode: string;
    originName: string;
    destinationCode: string;
    destinationName: string;
    departingAt: string;
    arrivingAt: string;
    duration?: string;
    fareBrandName?: string;
    segments: Array<{
      operatingCarrierName: string;
      marketingCarrierName?: string;
      flightNumber?: string;
      originCode: string;
      destinationCode: string;
      departingAt: string;
      arrivingAt: string;
      duration?: string;
    }>;
  }>;
  conditions?: {
    changeBeforeDeparture?: string | null;
    refundBeforeDeparture?: string | null;
  };
}

export interface BookingDocument {
  _id?: ObjectId;
  userId?: ObjectId;
  guestEmail?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  vertical: "flights";
  offerId: string;
  duffelOfferRequestId?: string;
  duffelOrderId?: string;
  duffelLastEventId?: string;
  duffelLastEventType?: string;
  duffelLastEventAt?: Date;
  airlineBookingReference?: string;
  whopCheckoutConfigId?: string;
  whopPaymentId?: string;
  amount: number;
  currency: string;
  serviceFeeAmount: number;
  offerSnapshot: NormalizedFlightOffer;
  passengers: PassengerInput[];
  contact: {
    email: string;
    phone?: string;
  };
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethodDocument {
  _id?: ObjectId;
  userId: ObjectId;
  whopPaymentMethodId: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  billingName?: string;
  status: "active" | "expired" | "removed";
  createdAt: Date;
  updatedAt: Date;
}

export interface PassengerInput {
  id?: string;
  type?: "adult" | "child" | "infant";
  title?: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
}
