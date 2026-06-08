import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { SuppliersManager } from "@/components/admin/SuppliersManager";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("*").order("name");

  return <SuppliersManager suppliers={(data as Supplier[]) ?? []} />;
}
