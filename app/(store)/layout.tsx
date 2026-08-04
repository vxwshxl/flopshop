import { Navbar, type NavUser } from "@/components/store/Navbar";
import { Marquee } from "@/components/store/Marquee";
import { Footer } from "@/components/store/Footer";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import { getAuthUser, getCurrentProfile, getSettings, toNavUser } from "@/lib/supabase/queries";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Resolve the signed-in user server-side (the auth cookie is HttpOnly, so the
  // browser can't read it — the navbar must be told who is logged in).
  const [settings, user, profile] = await Promise.all([
    getSettings(),
    getAuthUser(),
    getCurrentProfile(),
  ]);

  const navUser: NavUser | null = toNavUser(user);
  const role: Role | null = user ? ((profile?.role as Role) ?? "user") : null;

  return (
    <SettingsProvider initial={settings}>
      <div className="flex min-h-screen flex-col bg-black">
        <Marquee />
        <Navbar shopName={settings.shop_name} user={navUser} role={role} />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </SettingsProvider>
  );
}
