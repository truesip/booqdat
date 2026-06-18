"use client";

import { useRouter } from "next/navigation";
import { SearchResultsLayout } from "@/components/flights/search-results-layout";
import type { NormalizedFlightOffer } from "@/lib/types";

type Props = {
  offers: NormalizedFlightOffer[];
  offerRequestId: string;
};

export function SearchResultsContainer({ offers, offerRequestId }: Props) {
  const router = useRouter();

  async function handleSelectOffer(offer: NormalizedFlightOffer) {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer })
    });

    if (!response.ok) {
      alert("Unable to start checkout. Please refresh the offer and try again.");
      throw new Error("Checkout start failed");
    }

    const data = (await response.json()) as { bookingId: string };
    router.push(`/flights/checkout/${data.bookingId}`);
  }

  return (
    <SearchResultsLayout
      offers={offers}
      offerRequestId={offerRequestId}
      onSelectOffer={handleSelectOffer}
    />
  );
}
