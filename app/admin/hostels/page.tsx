import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { HostelsManager } from "@/components/admin/HostelsManager";
import type { Hostel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HostelsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("hostels").select("*").order("name");

  return <HostelsManager hostels={(data as Hostel[]) ?? []} />;
}
