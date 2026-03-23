import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Bot Noct",
  description: "CRM-система для управления заявками",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        {/* Skip link for keyboard navigation */}
        <a href="#main-content" className="skip-link">
          Перейти к основному содержанию
        </a>
        {children}
      </body>
    </html>
  );
}
