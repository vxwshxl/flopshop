import { Navbar } from "@/components/store/Navbar";
import { getSettings } from "@/lib/supabase/queries";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const isOpen = settings.shop_is_open !== "false";

  return (
    <div className="min-h-screen bg-white">
      <Navbar shopName={settings.shop_name} isOpen={isOpen} />
      {children}
    </div>
  );
}
