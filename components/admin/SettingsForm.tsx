"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { SettingsMap } from "@/lib/types";

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsMap>({ ...settings });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const deliveryFee = Number(form.delivery_fee ?? 0);
  const deliveryShare = Number(form.delivery_person_share ?? 0);
  const adminShare = Math.max(deliveryFee - deliveryShare, 0);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const next: SettingsMap = { ...form, admin_delivery_share: String(adminShare) };

    const keys = [
      "shop_name",
      "shop_tagline",
      "shop_email",
      "shop_phone",
      "shop_address",
      "currency_symbol",
      "delivery_fee",
      "delivery_person_share",
      "admin_delivery_share",
      "min_order_for_delivery",
      "shop_is_open",
    ];

    for (const key of keys) {
      const value = next[key] ?? "";
      const { error } = await supabase
        .from("settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) {
        setSaving(false);
        return toast.error(`Failed to save ${key}: ${error.message}`);
      }
    }
    setSaving(false);
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminCard title="Company Information">
        <div className="space-y-4">
          <Field label="Shop Name" value={form.shop_name ?? ""} onChange={set("shop_name")} />
          <Field label="Tagline" value={form.shop_tagline ?? ""} onChange={set("shop_tagline")} />
          <Field label="Email" value={form.shop_email ?? ""} onChange={set("shop_email")} />
          <Field label="Phone" value={form.shop_phone ?? ""} onChange={set("shop_phone")} />
          <Field label="Address" value={form.shop_address ?? ""} onChange={set("shop_address")} />
        </div>
      </AdminCard>

      <div className="space-y-4">
        <AdminCard title="Financial">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency Symbol" value={form.currency_symbol ?? ""} onChange={set("currency_symbol")} />
            <Field label="Min Order for Delivery" type="number" value={form.min_order_for_delivery ?? "0"} onChange={set("min_order_for_delivery")} />
            <Field label="Delivery Fee (₹)" type="number" value={form.delivery_fee ?? "0"} onChange={set("delivery_fee")} />
            <Field label="Delivery Person Share (₹)" type="number" value={form.delivery_person_share ?? "0"} onChange={set("delivery_person_share")} />
          </div>
          <div className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-400">
            Split: {form.currency_symbol}{deliveryFee} total = {form.currency_symbol}{deliveryShare} delivery person +{" "}
            <span className="text-stone-950 dark:text-white">{form.currency_symbol}{adminShare} admin</span> (auto-calculated)
          </div>
        </AdminCard>

        <Button onClick={save} loading={saving} variant="dark" className="w-full">
          Save all settings
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={onChange} />
    </div>
  );
}
