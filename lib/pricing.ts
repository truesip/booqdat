import type { NormalizedFlightOffer } from "@/lib/types";

export function calculateFlightPrice(offer: NormalizedFlightOffer) {
  const baseTotal = Number(offer.totalAmount);
  const percent = Number(process.env.BOOQDAT_SERVICE_FEE_PERCENT ?? "5");
  const flat = Number(process.env.BOOQDAT_SERVICE_FEE_FLAT ?? "0");
  const serviceFeeAmount = roundMoney(baseTotal * (percent / 100) + flat);
  const finalAmount = roundMoney(baseTotal + serviceFeeAmount);

  return {
    supplierAmount: roundMoney(baseTotal),
    serviceFeeAmount,
    finalAmount,
    currency: offer.totalCurrency
  };
}

export function calculateEventPrice(ticketPrice: number, quantity: number) {
  const baseTotal = ticketPrice * quantity;
  const serviceFeeAmount = 5.00; // flat platform fee of $5.00
  const finalAmount = baseTotal + serviceFeeAmount;

  return {
    supplierAmount: roundMoney(baseTotal),
    serviceFeeAmount,
    finalAmount,
    currency: "USD"
  };
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
