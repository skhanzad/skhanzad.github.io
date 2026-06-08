import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  getSiteUrl,
} from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Sourena Khanzadeh's portfolio — AI systems, research, and engineering.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "Sourena Khanzadeh's portfolio — AI systems, research, and engineering.",
    locale: "en_US",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Sourena Khanzadeh's portfolio — AI systems, research, and engineering.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
