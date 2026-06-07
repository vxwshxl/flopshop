import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirect=/admin");
  if (profile.role !== "admin") redirect("/");

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100">
      <Sidebar shopName={settings.shop_name} />
      <main className="md:pl-[220px]">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
