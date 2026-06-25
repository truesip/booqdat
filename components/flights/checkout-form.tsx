"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { BookingDocument } from "@/lib/types";
import { X, Maximize2, Briefcase, Armchair } from "lucide-react";

const countries = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CV", name: "Cape Verde" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (Democratic Republic)" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "CI", name: "Ivory Coast" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KP", name: "North Korea" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" }
];

export function CheckoutForm({ bookingId, booking }: { bookingId: string; booking: BookingDocument }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<{
    sessionId?: string;
    purchaseUrl?: string;
    environment?: "production" | "sandbox";
  } | null>(null);

  // Seat selection states
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [tempSelectedSeat, setTempSelectedSeat] = useState<string | null>(null);

  // Metadata states
  const [metadata, setMetadata] = useState<Array<{ key: string; value: string }>>([{ key: "", value: "" }]);

  // Mock seat map availability configuration
  const occupiedSeats = useMemo(() => {
    const set = new Set<string>();
    // Pre-populate some occupied seats randomly for row 8 to 29
    for (let r = 8; r <= 29; r++) {
      ["A", "B", "C", "D", "E", "F"].forEach((col) => {
        // High occupancy (e.g. 75% occupied)
        if (Math.random() < 0.75) {
          // Keep a few specific rows partially open for selection
          if (!(r === 15 && col === "A") && !(r === 23 && col === "A") && !([24, 25, 26, 27, 28, 29].includes(r) && ["E", "F"].includes(col))) {
            set.add(`${r}${col}`);
          }
        }
      });
    }
    return set;
  }, []);

  function handleSelectSeatCell(seat: string) {
    if (occupiedSeats.has(seat)) return;
    setTempSelectedSeat(seat === tempSelectedSeat ? null : seat);
  }

  function handleConfirmSeatSelection() {
    setSelectedSeat(tempSelectedSeat);
    setShowSeatMap(false);
  }

  function handleAddMetadataRow() {
    setMetadata([...metadata, { key: "", value: "" }]);
  }

  function handleMetadataChange(index: number, field: "key" | "value", val: string) {
    const updated = [...metadata];
    updated[index][field] = val;
    setMetadata(updated);
  }

  async function submitPassenger(formData: FormData) {
    setLoading(true);
    
    // Parse metadata pairs into a clean object if keys exist
    const parsedMetadata: Record<string, string> = {};
    metadata.forEach((row) => {
      if (row.key.trim()) {
        parsedMetadata[row.key.trim()] = row.value.trim();
      }
    });

    const payload = {
      contact: {
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "")
      },
      passengers: [
        {
          type: "adult",
          title: String(formData.get("title") ?? "mr"),
          givenName: String(formData.get("givenName") ?? ""),
          familyName: String(formData.get("familyName") ?? ""),
          bornOn: String(formData.get("bornOn") ?? ""),
          gender: String(formData.get("gender") ?? "m"),
          email: String(formData.get("email") ?? ""),
          phoneNumber: String(formData.get("phone") ?? "")
        }
      ],
      selectedSeat: selectedSeat || undefined,
      metadata: Object.keys(parsedMetadata).length > 0 ? parsedMetadata : undefined
    };

    const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!bookingResponse.ok) {
      setLoading(false);
      alert("Please check passenger details and try again.");
      return;
    }

    const checkoutResponse = await fetch("/api/payments/whop/checkout-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId })
    });

    if (!checkoutResponse.ok) {
      setLoading(false);
      alert("Unable to create payment session. Please try again.");
      return;
    }

    const checkout = (await checkoutResponse.json()) as {
      sessionId?: string;
      purchaseUrl?: string;
      environment?: "production" | "sandbox";
    };
    setCheckoutSession(checkout);
    setLoading(false);
  }

  // Calculate pricing breakdown exactly like Duffel Screenshot 2
  const platformFee = booking.serviceFeeAmount || 0;
  const baseFlightAmount = booking.amount - platformFee;
  const taxAmount = parseFloat((baseFlightAmount * 0.21).toFixed(2)); // mock taxes at 21% of base flight
  const fareBaseAmount = parseFloat((baseFlightAmount - taxAmount).toFixed(2));

  if (checkoutSession?.sessionId) {
    return (
      <div className="rounded-[2rem] bg-white p-6 shadow-card">
        <h2 className="text-2xl font-black">Secure checkout</h2>
        <p className="mt-2 text-sm text-ink/60">Complete payment securely without leaving BooqDat.</p>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <WhopCheckoutEmbed
            sessionId={checkoutSession.sessionId}
            returnUrl={`${window.location.origin}/booking/${bookingId}/status`}
            environment={checkoutSession.environment ?? (process.env.NEXT_PUBLIC_WHOP_CHECKOUT_ENVIRONMENT === "production" ? "production" : "sandbox")}
            theme="light"
            themeOptions={{
              accentColor: "orange",
              borderRadius: 18,
              backgroundColor: "#ffffff"
            }}
            onComplete={() => router.push(`/booking/${bookingId}/status`)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={submitPassenger} className="space-y-6">
        {/* Contact Details Section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
          <h2 className="text-xl font-black text-ink">Contact details</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Email *">
              <Input name="email" type="email" defaultValue={booking.contact.email === "pending@booqdat.local" ? "" : booking.contact.email} required />
            </Field>
            <Field label="Phone number *">
              <Input name="phone" type="tel" defaultValue={booking.contact.phone ?? ""} required placeholder="+1 617 756 2626" />
            </Field>
          </div>
        </section>

        {/* Passengers details section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5">
          <h2 className="text-xl font-black text-ink">Passengers</h2>
          <div className="mt-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orangebrand">
            Adult 1
          </div>

          <div className="mt-6 space-y-6">
            {/* Personal Details Subsection */}
            <div>
              <h3 className="text-sm font-black text-ink/50 uppercase tracking-wider">Personal details</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Title *">
                  <Select name="title" defaultValue="mr">
                    <option value="mr">Mr.</option>
                    <option value="mrs">Mrs.</option>
                    <option value="ms">Ms.</option>
                    <option value="mx">Mx.</option>
                  </Select>
                </Field>
                <Field label="Given name *">
                  <Input name="givenName" required />
                </Field>
                <Field label="Family name *">
                  <Input name="familyName" required />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Date of birth *">
                  <Input name="bornOn" type="date" required />
                </Field>
                <Field label="Gender *">
                  <Select name="gender" defaultValue="m">
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                    <option value="x">Unspecified</option>
                  </Select>
                </Field>
              </div>
            </div>

            <hr className="border-orange-50" />

            {/* Passport Details Subsection */}
            <div>
              <h3 className="text-sm font-black text-ink/50 uppercase tracking-wider">Passport details</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Country of Issue">
                  <Select name="passportCountry" defaultValue="US">
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Passport number">
                  <Input name="passportNumber" placeholder="L12345678" />
                </Field>
                <Field label="Expiry date">
                  <Input name="passportExpiry" type="date" />
                </Field>
              </div>
            </div>
          </div>
        </section>

        {/* Add Extras Section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-4">
          <h2 className="text-xl font-black text-ink">Add extras</h2>
          
          {/* Baggage Row */}
          <div className="flex items-center justify-between rounded-3xl bg-cloud p-5 border border-orange-100">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Briefcase className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-ink">Extra baggage</p>
                <p className="text-[11px] font-bold text-ink/50 mt-0.5">Add any extra baggage you need for your trip</p>
              </div>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 select-none">
              Not available
            </span>
          </div>

          {/* Interactive Seat Selection Row */}
          <div
            onClick={() => { setTempSelectedSeat(selectedSeat); setShowSeatMap(true); }}
            className="flex items-center justify-between rounded-3xl bg-cloud p-5 border border-orange-100 cursor-pointer hover:border-orangebrand/40 transition group"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orangebrand/10 text-orangebrand">
                <Armchair className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-ink">Seat selection</p>
                <p className="text-[11px] font-bold text-ink/50 mt-0.5">Specify where on the plane you&apos;d like to sit</p>
              </div>
            </div>
            
            {selectedSeat ? (
              <span className="rounded-full bg-orangebrand/15 px-4 py-1.5 text-xs font-black text-orangebrand animate-scaleIn">
                Seat {selectedSeat}
              </span>
            ) : (
              <span className="text-slate-400 group-hover:text-orangebrand transition-all">
                <Maximize2 className="h-5 w-5" />
              </span>
            )}
          </div>
        </section>

        {/* Add Metadata Section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-4">
          <h2 className="text-xl font-black text-ink">Add metadata</h2>
          <div className="space-y-4">
            {metadata.map((row, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-2">
                <Field label="Key (optional)">
                  <Input
                    value={row.key}
                    onChange={(e) => handleMetadataChange(index, "key", e.target.value)}
                    placeholder="e.g. loyalty_id"
                  />
                </Field>
                <Field label="Value (optional)">
                  <Input
                    value={row.value}
                    onChange={(e) => handleMetadataChange(index, "value", e.target.value)}
                    placeholder="e.g. 12345678"
                  />
                </Field>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddMetadataRow}
              className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition select-none pt-2"
            >
              Add another key/value pair
            </button>
          </div>
        </section>

        {/* Payment table summary section */}
        <section className="rounded-[2rem] bg-white p-6 shadow-card border border-orangebrand/5 space-y-4 text-ink">
          <h2 className="text-xl font-black">Payment</h2>
          
          <div className="space-y-3 mt-4 text-sm font-semibold border-b border-slate-50 pb-4">
            <div className="flex justify-between items-center text-ink/65">
              <span>Fare</span>
              <span>{formatCurrency(fareBaseAmount, booking.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-ink/65">
              <span>Fare taxes</span>
              <span>{formatCurrency(taxAmount, booking.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-ink/65">
              <span>BooqDat platform fee</span>
              <span>{formatCurrency(platformFee, booking.currency)}</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-lg font-black pt-2">
            <span>Total (USD)</span>
            <span className="text-orangebrand">{formatCurrency(booking.amount, booking.currency)}</span>
          </div>
        </section>

        <Button disabled={loading} className="h-16 w-full text-base bg-black text-white hover:bg-slate-900 rounded-2xl font-black">
          {loading ? "Preparing payment..." : "Pay with Balance"}
        </Button>
      </form>

      {/* DETAILED GRAPHICAL SEAT MAP MODAL POPUP */}
      {showSeatMap && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-hidden select-none animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] flex flex-col h-[90vh] w-full max-w-[420px] overflow-hidden relative border border-slate-100">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-orange-50 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                  <Armchair className="h-4.5 w-4.5 text-orangebrand" />
                  Flight to {booking.offerSnapshot!.slices[0].destinationCode}
                </h3>
                <p className="text-[10px] font-black text-ink/40 uppercase mt-0.5">{formatDateShort(booking.offerSnapshot!.slices[0].departingAt)}</p>
                <p className="text-xs font-black text-ink mt-2">Passenger 1</p>
              </div>
              <button
                onClick={() => setShowSeatMap(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Legend */}
            <div className="px-6 py-4 bg-cloud border-b border-orange-50/50 shrink-0 flex flex-wrap gap-x-4 gap-y-2 text-[9px] font-black text-ink/50 tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-slate-100 border border-slate-200 text-slate-500 font-sans font-bold text-[8px]">\</span>
                <span>Additional Cost</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded bg-white border border-slate-300" />
                <span>Included</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded bg-black" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-slate-50 border border-slate-150 text-slate-400 text-[8px]">X</span>
                <span>Unavailable/Restricted</span>
              </div>
            </div>

            {/* Aisle markers */}
            <div className="px-6 py-2 border-b border-orange-50/30 text-[9px] font-black text-ink/40 uppercase flex justify-between shrink-0 tracking-wider">
              <span className="flex items-center gap-1">← Exit</span>
              <span className="flex items-center gap-1">🚻 Lavatory</span>
              <span className="flex items-center gap-1">☕ Galley</span>
            </div>

            {/* Scrollable grid map */}
            <div className="flex-1 overflow-y-auto py-6 px-8 space-y-3 font-mono text-sm">
              {Array.from({ length: 22 }, (_, i) => {
                const row = i + 8; // rows 8 to 29
                return (
                  <div key={row} className="flex items-center justify-between gap-4">
                    {/* Columns A B C */}
                    <div className="flex gap-2">
                      {["A", "B", "C"].map((col) => {
                        const seatCode = `${row}${col}`;
                        const isOccupied = occupiedSeats.has(seatCode);
                        const isSelected = tempSelectedSeat === seatCode;

                        return (
                          <button
                            key={col}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => handleSelectSeatCell(seatCode)}
                            className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold transition-all border ${
                              isOccupied
                                ? "bg-slate-50 border-slate-150 text-slate-400 cursor-not-allowed"
                                : isSelected
                                ? "bg-black border-black text-white font-black"
                                : "bg-white border-slate-300 text-ink/75 hover:border-orangebrand"
                            }`}
                          >
                            {isOccupied ? "x" : col}
                          </button>
                        );
                      })}
                    </div>

                    {/* Row Number spacer */}
                    <span className="text-[10px] font-black text-slate-300 w-4 text-center select-none">{row}</span>

                    {/* Columns D E F */}
                    <div className="flex gap-2">
                      {["D", "E", "F"].map((col) => {
                        const seatCode = `${row}${col}`;
                        const isOccupied = occupiedSeats.has(seatCode);
                        const isSelected = tempSelectedSeat === seatCode;

                        return (
                          <button
                            key={col}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => handleSelectSeatCell(seatCode)}
                            className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold transition-all border ${
                              isOccupied
                                ? "bg-slate-50 border-slate-150 text-slate-400 cursor-not-allowed"
                                : isSelected
                                ? "bg-black border-black text-white font-black"
                                : "bg-white border-slate-300 text-ink/75 hover:border-orangebrand"
                            }`}
                          >
                            {isOccupied ? "x" : col}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-orange-50 shrink-0 bg-slate-50/50 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs font-black text-ink">
                <span>Price for {tempSelectedSeat ? "1 seat" : "0 seats"}</span>
                <span className="text-orangebrand font-black">+ US$0.00</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowSeatMap(false)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white text-xs font-black text-ink/50 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSeatSelection}
                  className="h-11 rounded-2xl bg-black text-xs font-black text-white hover:bg-slate-900 transition"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Add memo helper since we use it in component body

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
