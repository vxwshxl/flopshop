import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "delivery" && profile.role !== "admin")) redirect("/");

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-black text-stone-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/delivery" className="flex items-center gap-2 font-bold text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-400 text-sm text-black">🛵</span>
            {settings.shop_name}
          </Link>
          <nav className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar whitespace-nowrap pl-2">
            <Link
              href="/delivery"
              className="rounded-lg px-3 py-1.5 text-stone-400 transition hover:bg-lime-400/10 hover:text-lime-300"
            >
              Active
            </Link>
            <Link
              href="/delivery/history"
              className="rounded-lg px-3 py-1.5 text-stone-400 transition hover:bg-lime-400/10 hover:text-lime-300"
            >
              History
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-stone-400 transition hover:bg-lime-400/10 hover:text-lime-300"
            >
              Shop
            </Link>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-stone-400 transition hover:bg-red-400/10 hover:text-red-300">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
