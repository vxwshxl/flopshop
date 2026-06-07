import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeScript } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlopShop — Your Hostel Snack Shop",
  description: "Order snacks, drinks and noodles for pickup or delivery to your hostel room.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/FlopShop.webp",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-black/10 bg-white px-4 py-6 text-sm text-stone-600 dark:border-white/10 dark:bg-stone-950 dark:text-stone-400">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} FlopShop.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/privacy" className="hover:text-stone-900 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-stone-900 dark:hover:text-white">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { fontSize: "14px" },
          }}
        />
      </body>
    </html>
  );
}
