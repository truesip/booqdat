"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, LayoutDashboard, LogOut, ReceiptText, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/dashboard/profile", "Profile", UserRound],
  ["/dashboard/orders", "Orders purchased", ReceiptText],
  ["/dashboard/payment-methods", "Payment methods", CreditCard],
  ["/dashboard/security", "Security", Shield]
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="rounded-[2rem] border border-orangebrand/10 bg-white p-4 text-ink shadow-card lg:sticky lg:top-24 lg:h-fit">
      <nav className="grid gap-2">
        {items.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
              pathname === href ? "bg-orangebrand text-white" : "text-ink/65 hover:bg-orangebrand/10 hover:text-orangeburnt"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-ink/65 transition hover:bg-orangebrand/10 hover:text-orangeburnt"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </nav>
    </aside>
  );
}
