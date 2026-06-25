import type { ObjectId } from "mongodb";

export type UserRole = "customer" | "admin" | "promoter";

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
  whopCompanyId?: string;
  whopCompanyStatus?: string;
  whopOnboarded?: boolean;
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
  whopCompanyId?: string;
  whopCompanyStatus?: string;
  whopOnboarded?: boolean;
  createdAt: Date;
  updatedAt: Date;
  whopCompanyId?: string;
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

export interface EventDocument {
  _id?: ObjectId;
  promoterId: ObjectId;
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  date: Date;
  time?: string;
  venueType?: "Physical" | "Online";
  venue?: string;
  city: string;
  state?: string;
  country?: string;
  capacity?: number;
  gaPrice: number;
  gaQty: number;
  vipPrice?: number;
  vipQty?: number;
  banner?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventTicketSnapshot {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  city: string;
  venue: string;
  ticketType: "ga" | "vip";
  ticketPrice: number;
  quantity: number;
}

export interface BookingDocument {
  _id?: ObjectId;
  userId?: ObjectId;
  guestEmail?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  vertical: "flights" | "events";
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
  offerSnapshot?: NormalizedFlightOffer;
  eventSnapshot?: EventTicketSnapshot;
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

export interface EventDocument {
  _id?: ObjectId;
  promoterId: ObjectId;
  title: string;
  description: string;
  date: Date;
  location: string;
  latitude?: number;
  longitude?: number;
  ticketPrice: number;
  ticketQuantity: number;
  ticketsSold: number;
  whopCompanyId?: string;
  createdAt: Date;
  updatedAt: Date;
}
