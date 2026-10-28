import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MfaroForex | Trade Smarter. Grow Further.",
  description: "Your markets. Your perspective. A professional forex demo trading terminal.",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = {width:'device-width', initialScale:1, themeColor:'#0A1F44'};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

