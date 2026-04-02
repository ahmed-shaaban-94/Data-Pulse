import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://datapulse.dev"),
  title: {
    default: "DataPulse - Turn Raw Sales Data into Revenue Intelligence",
    template: "%s | DataPulse",
  },
  description:
    "Import, clean, analyze, and visualize your sales data with an automated medallion pipeline. AI-powered insights, real-time dashboards, and enterprise-grade quality gates.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "DataPulse",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="bg-page font-sans text-text-primary antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
