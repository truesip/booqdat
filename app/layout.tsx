import type { Metadata } from "next";
import "./globals.css";

const inter = { className: "font-sans" };

export const metadata: Metadata = {
  title: "BooqDat | Premium flight booking and travel marketplace",
  description: "Book flights with BooqDat. Hotels, car rentals, and event tickets are coming soon.",
  metadataBase: getMetadataBase()
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

function getMetadataBase() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return new URL("http://localhost:3000");

  try {
    return new URL(appUrl);
  } catch {
    return new URL(`https://${appUrl}`);
  }
}
