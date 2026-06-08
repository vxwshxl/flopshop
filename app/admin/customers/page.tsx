import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { CustomersManager } from "@/components/admin/CustomersManager";
import type { Customer, Hostel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("name");
  
  const { data: hostelsData } = await supabase
    .from("hostels")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <CustomersManager 
      customers={(data as Customer[]) ?? []} 
      hostels={(hostelsData as Hostel[]) ?? []} 
    />
  );
}
