"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, User, Package, LogOut } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { useUser } from "@/lib/hooks/useUser";

export function Navbar({ shopName = "FlopShop", isOpen = true }: { shopName?: string; isOpen?: boolean }) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const { profile, isAuthenticated } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const count = hydrated ? items.reduce((s, i) => s + i.quantity, 0) : 0;

  useEffect(() => {
    const close = () => setMenuOpen(false);
    if (menuOpen) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
            🛒
          </span>
          {shopName}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/cart"
            className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="flex items-center gap-1.5 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              >
                <User className="h-5 w-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
                    {profile?.full_name ?? profile?.email}
                  </div>
                  <Link href="/orders" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Package className="h-4 w-4" /> My Orders
                  </Link>
                  {profile?.role === "admin" && (
                    <Link href="/admin" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Admin Panel
                    </Link>
                  )}
                  {(profile?.role === "delivery" || profile?.role === "admin") && (
                    <Link href="/delivery" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Delivery Panel
                    </Link>
                  )}
                  <form action="/auth/signout" method="post">
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
