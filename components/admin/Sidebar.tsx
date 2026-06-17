"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  PlusCircle,
  Truck,
  Bike,
  Package,
  Tags,
  FileText,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  Store,
  Building2,
  Contact,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operate",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/orders/new", label: "Manual Order", icon: PlusCircle },
      { href: "/admin/purchases", label: "Purchases", icon: Truck },
      { href: "/admin/delivery", label: "Delivery", icon: Bike },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    title: "Setup",
    items: [
      { href: "/admin/hostels", label: "Hostels", icon: Store },
      { href: "/admin/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/shareholders", label: "Shareholders", icon: Users },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/customers", label: "Customers", icon: Contact },
      { href: "/admin/wallet", label: "Wallet", icon: Wallet },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ shopName = "FlopShop" }: { shopName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);



  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    document.addEventListener("toggleSidebar", handleToggle);
    return () => document.removeEventListener("toggleSidebar", handleToggle);
  }, []);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-500">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      isActive(item.href)
                        ? "bg-lime-400 font-semibold text-stone-950"
                        : "text-stone-600 hover:bg-black/5 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/10 p-3 dark:border-white/10">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-black/5 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Store className="h-4 w-4" /> View Store
        </Link>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-stone-600 hover:bg-black/5 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-line fixed bottom-0 left-0 top-16 hidden w-[220px] border-r bg-white/55 backdrop-blur-xl dark:bg-stone-950/45 md:block">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-0 left-0 w-[260px]">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-stone-500 dark:text-stone-400">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
