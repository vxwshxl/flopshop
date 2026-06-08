import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-black font-sans text-white">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { fontSize: "14px", background: "#111", color: "#fff", border: "1px solid #262626" },
          }}
        />
      </body>
    </html>
  );
}
