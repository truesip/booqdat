"use client";

import {
  BalanceElement,
  Elements,
  PayoutsSession,
  WithdrawButtonElement,
  WithdrawalsElement,
} from "@whop/embedded-components-react-js";
import { loadWhopElements } from "@whop/embedded-components-vanilla-js";

const elements = loadWhopElements();

export function BalancesClient({ companyId }: { companyId: string }) {
  const fetchToken = async () => {
    const res = await fetch("/api/promoter/token", { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to fetch promoter access token");
    }
    const data = await res.json();
    return data.token;
  };

  const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/dashboard/balances` : "";

  return (
    <div className="grid gap-6">
      <Elements elements={elements}>
        <PayoutsSession
          token={fetchToken}
          companyId={companyId}
          redirectUrl={redirectUrl}
        >
          <div className="grid gap-6">
            <div className="rounded-[1.5rem] border border-orangebrand/10 p-5 bg-cloud/40">
              <h3 className="text-lg font-bold mb-3">Available Balance</h3>
              <div style={{ position: "relative", minHeight: "100px" }}>
                <BalanceElement fallback={<div className="animate-pulse bg-cloud h-24 rounded-2xl" />} />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-orangebrand/10 p-5 bg-cloud/40">
              <h3 className="text-lg font-bold mb-3">Withdraw Funds</h3>
              <div style={{ position: "relative", minHeight: "45px" }}>
                <WithdrawButtonElement fallback={<div className="animate-pulse bg-cloud h-12 rounded-2xl" />} />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-orangebrand/10 p-5 bg-cloud/40">
              <h3 className="text-lg font-bold mb-3">Payout History</h3>
              <div style={{ position: "relative", minHeight: "150px" }}>
                <WithdrawalsElement fallback={<div className="animate-pulse bg-cloud h-36 rounded-2xl" />} />
              </div>
            </div>
          </div>
        </PayoutsSession>
      </Elements>
      
      <div className="mt-4 text-center">
        <a 
          href="/api/promoter/onboarding" 
          className="text-sm font-bold text-orangebrand hover:text-orangebrand/80 transition underline"
        >
          Need to update your KYC details or banking info? Onboard with Whop here &rarr;
        </a>
      </div>
    </div>
  );
}
