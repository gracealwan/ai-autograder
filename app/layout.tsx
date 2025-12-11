import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavBar";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goblins Autograder",
  description: "Goblins Autograder demo app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthGuard>
          <div className="app-shell">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
