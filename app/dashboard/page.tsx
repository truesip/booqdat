import { Plane, ReceiptText, UserRound, WalletCards, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listUserBookings } from "@/lib/bookings";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  const bookings = current?.user._id ? await listUserBookings(current.user._id.toString()) : [];
  const cards: Array<{ label: string; value: string | number; icon: LucideIcon; href: string }> = [
    { label: "Orders", value: bookings.length, icon: ReceiptText, href: "/dashboard/orders" },
    {
      label: "Active flights",
      value: bookings.filter((booking) => booking.status === "confirmed").length,
      icon: Plane,
      href: "/dashboard/orders"
    },
    { label: "Profile", value: current?.profile?.fullName ? "Ready" : "Incomplete", icon: UserRound, href: "/dashboard/profile" },
    { label: "Payment methods", value: "Preview", icon: WalletCards, href: "/dashboard/payment-methods" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Customer dashboard</p>
        <h1 className="mt-3 text-4xl font-black">Welcome back{current?.profile?.fullName ? `, ${current.profile.fullName}` : ""}.</h1>
        <p className="mt-3 max-w-2xl text-ink/65">Manage your profile, purchased orders, payment method previews, and security settings.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-[2rem] bg-white p-5 shadow-card transition hover:-translate-y-1">
            <Icon className="h-7 w-7 text-orangebrand" />
            <p className="mt-5 text-sm font-bold text-ink/50">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
