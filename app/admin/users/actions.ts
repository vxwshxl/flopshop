"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

async function requireRole(roles: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data?.role ?? "user") as Role;
  return roles.includes(role) ? { id: user.id, role } : null;
}

export async function setUserRoleAction(userId: string, role: Role) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: !isActive }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
