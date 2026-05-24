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
  title: "Football Match Predictor",
  description:
    "A machine learning model that estimates pre-match win probabilities across Europe's top 5 leagues — Premier League, La Liga, Bundesliga, Serie A, and Ligue 1.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Football Match Predictor",
    description:
      "Predict any fixture across Europe's top 5 leagues using real form data. Built with logistic regression and strict temporal validation.",
    url: SITE_URL,
    siteName: "PL Matchup Predictor",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Football Match Predictor",
    description:
      "ML-powered win probability predictions for fixtures across Europe's top 5 leagues, based on recent form.",
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
