import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://matchpredictor.net";

export const metadata: Metadata = {
  title: "Premier League Matchup Predictor",
  description:
    "A machine learning model that estimates pre-match win probabilities for any Premier League fixture, based on recent team form.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Premier League Matchup Predictor",
    description:
      "Predict any Premier League matchup using real form data from 6 seasons of results. Built with logistic regression and strict temporal validation.",
    url: SITE_URL,
    siteName: "PL Matchup Predictor",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Premier League Matchup Predictor",
    description:
      "ML-powered win probability predictions for any Premier League fixture, based on recent form.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
