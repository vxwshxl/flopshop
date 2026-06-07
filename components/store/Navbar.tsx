"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Package, User as UserIcon, LogOut, LayoutDashboard, Truck } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import type { Role } from "@/lib/types";

export interface NavUser {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function Navbar({
  shopName = "FlopShop",
  isOpen = true,
  user = null,
  role = null,
}: {
  shopName?: string;
  isOpen?: boolean;
  user?: NavUser | null;
  role?: Role | null;
}) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const [menuOpen, setMenuOpen] = useState(false);

  const count = hydrated ? items.reduce((s, i) => s + i.quantity, 0) : 0;
  const firstName = user?.name?.split(" ")[0] ?? "there";

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

        <div className="flex items-center gap-2">
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

          {user ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-full ring-2 ring-indigo-500/60 transition hover:ring-indigo-500"
                aria-label="Account"
              >
                <Avatar name={user.name} email={user.email} src={user.avatarUrl} />
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
                >
                  <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-600">
                      <Avatar name={user.name} email={user.email} src={user.avatarUrl} large />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-900">Hi, {firstName}</p>
                      <p className="truncate text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <div className="p-2">
                    <MenuLink href="/orders" icon={<Package className="h-4 w-4" />} label="My Orders" />
                    <MenuLink href="/profile" icon={<UserIcon className="h-4 w-4" />} label="Profile" />
                    {role === "admin" && (
                      <MenuLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Admin Panel" />
                    )}
                    {(role === "delivery" || role === "admin") && (
                      <MenuLink href="/delivery" icon={<Truck className="h-4 w-4" />} label="Delivery Panel" />
                    )}
                  </div>

                  <form action="/auth/signout" method="post" className="border-t border-gray-100 p-2">
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
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

function Avatar({
  name,
  email,
  src,
  large,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  large?: boolean;
}) {
  const initial = (name?.[0] || email?.[0] || "U").toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? "avatar"} referrerPolicy="no-referrer" className="h-full w-full object-cover" />;
  }
  return (
    <span className={`grid h-full w-full place-items-center bg-indigo-600 font-bold text-white ${large ? "text-lg" : "text-sm"}`}>
      {initial}
    </span>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {icon}
      {label}
    </Link>
  );
}
