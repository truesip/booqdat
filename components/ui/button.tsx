import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-ring disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-orangebrand text-white shadow-glow hover:-translate-y-0.5 hover:bg-orangeburnt",
  dark: "bg-orangeburnt text-white hover:-translate-y-0.5 hover:bg-orangebrand",
  light: "bg-white text-ink shadow-card ring-1 ring-orange-100 hover:-translate-y-0.5 hover:bg-orange-50",
  ghost: "bg-white text-ink ring-1 ring-orange-200 hover:bg-orange-50"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof variants;
};

export function LinkButton({ className, variant = "primary", href, ...props }: LinkButtonProps) {
  return <Link href={href} className={cn(base, variants[variant], className)} {...props} />;
}
