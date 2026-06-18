import { CreditCard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listPaymentMethods } from "@/lib/bookings";

export default async function PaymentMethodsPage() {
  const current = await getCurrentUser();
  const methods = current?.user._id ? await listPaymentMethods(current.user._id.toString()) : [];

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-card">
      <h1 className="text-3xl font-black">Payment methods</h1>
      <p className="mt-2 text-sm leading-6 text-ink/60">
        BooqDat only previews safe saved-payment details. Raw card numbers and CVC are never stored.
      </p>
      <div className="mt-6 grid gap-4">
        {methods.length ? methods.map((method) => (
          <div key={method._id?.toString()} className="rounded-3xl bg-cloud p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orangebrand/10 text-orangebrand">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black">{method.brand ?? "Card"} ending in {method.last4 ?? "••••"}</p>
                <p className="text-sm text-ink/55">
                  Expires {method.expMonth ?? "MM"}/{method.expYear ?? "YYYY"} · {method.billingName ?? "Billing name unavailable"}
                </p>
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-3xl bg-cloud p-8 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-orangebrand" />
            <p className="mt-4 text-xl font-black">Saved payment methods coming soon.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/60">
              Once saved payment methods are enabled, this menu will show brand, last four digits, expiration, and billing name only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
