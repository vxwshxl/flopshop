import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirect=/delivery");
  if (profile.role !== "delivery" && profile.role !== "admin") redirect("/");

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/delivery" className="flex items-center gap-2 font-bold text-white">
            🛵 {settings.shop_name} Delivery
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/delivery" className="rounded-lg px-3 py-1.5 text-gray-300 hover:bg-white/10">
              Active
            </Link>
            <Link href="/delivery/history" className="rounded-lg px-3 py-1.5 text-gray-300 hover:bg-white/10">
              History
            </Link>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-gray-300 hover:bg-white/10">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
