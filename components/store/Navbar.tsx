"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Package, User as UserIcon, LogOut, LayoutDashboard, Truck } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <Brand size={34} textClassName="text-content" />
          <span
            className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isOpen ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-500"
            }`}
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/cart"
            className="relative rounded-lg p-2 text-content hover:bg-elevated"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink">
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
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
                >
                  <div className="flex items-center gap-3 border-b border-line p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand">
                      <Avatar name={user.name} email={user.email} src={user.avatarUrl} large />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-content">Hi, {firstName}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
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

                  <form action="/auth/signout" method="post" className="border-t border-line p-2">
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-500/10">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-brand px-4 py-1.5 text-sm font-bold text-brand-ink hover:bg-brand-hover"
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
    <span className={`grid h-full w-full place-items-center bg-brand font-bold text-brand-ink ${large ? "text-lg" : "text-sm"}`}>
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
