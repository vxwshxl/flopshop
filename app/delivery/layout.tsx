import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser, getCurrentProfile, getSettings, toNavUser } from "@/lib/supabase/queries";
import { Navbar } from "@/components/store/Navbar";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "delivery" && profile.role !== "admin")) redirect("/");

  const [settings, navUser] = await Promise.all([getSettings(), getAuthUser().then(toNavUser)]);

  return (
    <SettingsProvider initial={settings}>
      <div className="flex min-h-screen flex-col bg-black text-stone-100">
        <Navbar shopName={settings.shop_name} user={navUser} role={profile.role as Role} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </div>
    </SettingsProvider>
  );
}
