import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlopShop — Midnight Cravings, Delivered",
  description: "Order snacks, drinks and noodles for pickup or delivery to your hostel room.",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/FlopShop.webp", type: "image/webp" }],
    apple: [{ url: "/FlopShop.webp" }],
  },
};

// Applied before paint to avoid a flash of the wrong theme. Defaults to the
// device preference when the user hasn't chosen explicitly.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: "14px" } }} />
      </body>
    </html>
  );
}
