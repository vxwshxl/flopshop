"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Package, User as UserIcon, LogOut, LayoutDashboard, Truck } from "lucide-react";
import { Brand } from "@/components/Brand";
import { useCart } from "@/lib/hooks/useCart";
import { useSettings } from "@/lib/hooks/useSettings";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

export interface NavUser {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function Navbar({
  shopName = "FlopShop",
  user = null,
  role = null,
}: {
  shopName?: string;
  user?: NavUser | null;
  role?: Role | null;
}) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const { isOpen } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  const count = hydrated ? items.reduce((s, i) => s + i.quantity, 0) : 0;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  useEffect(() => {
    const close = () => setMenuOpen(false);
    if (menuOpen) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Brand shopName={shopName} textClassName="text-white" />
          <span
            className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide sm:inline ${
              isOpen ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/cart"
            className="relative grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime-400 px-1 text-[10px] font-extrabold text-black ring-2 ring-black">
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
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-full ring-2 ring-lime-400/70 transition hover:ring-lime-400"
                aria-label="Account"
              >
                <Avatar name={user.name} email={user.email} src={user.avatarUrl} />
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="glass-strong absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-lime-400">
                      <Avatar name={user.name} email={user.email} src={user.avatarUrl} large />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">Hi, {firstName}</p>
                      <p className="truncate text-xs text-white/50">{user.email}</p>
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

                  <div className="border-t border-white/10 p-2">
                    <button
                      onClick={signOut}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-white/5"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-lime-400 px-4 py-1.5 text-sm font-bold text-black transition hover:bg-lime-300"
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
    <span className={`grid h-full w-full place-items-center bg-lime-400 font-bold text-black ${large ? "text-lg" : "text-sm"}`}>
      {initial}
    </span>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
    >
      {icon}
      {label}
    </Link>
  );
}
