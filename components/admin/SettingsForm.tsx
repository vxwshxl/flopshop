"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { sendTestNotificationAction } from "@/app/admin/settings/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import type { SettingsMap } from "@/lib/types";

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsMap>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    const res = await sendTestNotificationAction();
    setTesting(false);
    if (!res.ok) return toast.error(res.error ?? "Could not send test.");
    toast.success("Test notification sent — check your device.");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const deliveryFee = Number(form.delivery_fee ?? 0);
  const deliveryShare = Number(form.delivery_person_share ?? 0);
  const adminShare = Math.max(deliveryFee - deliveryShare, 0);

  // Free-delivery promo (0 = off, blank date = no end).
  const promoMin = Number(form.free_delivery_min ?? 0);
  const promoUntil = (form.free_delivery_until ?? "").trim();

  // Which order types customers may pick in the cart.
  const enabledTypes = new Set((form.order_types_enabled ?? "pickup,delivery").split(",").filter(Boolean));
  function toggleType(type: "pickup" | "delivery") {
    const next = new Set(enabledTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    // Never allow zero enabled types — keep at least the one just toggled off's pair.
    if (next.size === 0) {
      toast.error("At least one order type must stay enabled.");
      return;
    }
    setForm((f) => ({ ...f, order_types_enabled: ["pickup", "delivery"].filter((t) => next.has(t)).join(",") }));
  }

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
      "order_types_enabled",
      "free_delivery_min",
      "free_delivery_until",
    ];

    for (const key of keys) {
      const value = next[key] ?? "";
      // Upsert, not update: a key introduced after the shop's DB was seeded has
      // no row yet, and a plain update would silently save nothing.
      const { error } = await supabase
        .from("settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
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
          <Field label="Address (pickup location)" value={form.shop_address ?? ""} onChange={set("shop_address")} />
          <p className="-mt-2 text-xs text-stone-500 dark:text-stone-400">
            Shown to customers as the pickup point on checkout &amp; the order page.
          </p>
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

        <AdminCard title="Free Delivery Promo">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={`Free over (${form.currency_symbol ?? "₹"})`}
              type="number"
              value={form.free_delivery_min ?? "0"}
              onChange={set("free_delivery_min")}
            />
            <div>
              <Label>Runs until (last day)</Label>
              <DatePicker
                value={form.free_delivery_until ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, free_delivery_until: v }))}
              />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-400">
            {promoMin > 0 ? (
              <>
                Delivery orders of{" "}
                <span className="text-stone-950 dark:text-white">
                  {form.currency_symbol}{promoMin}
                </span>{" "}
                or more ship free{promoUntil ? <> until {promoUntil}</> : <> (no end date)</>}. The
                delivery person is still paid {form.currency_symbol}{deliveryShare} — it comes out of
                the shop&apos;s profit on that order.
              </>
            ) : (
              <>Promo off — set an amount above 0 to run it.</>
            )}
          </div>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Clear the date to run it indefinitely. Orders already placed keep the fee they were
            charged.
          </p>
        </AdminCard>

        <AdminCard title="Storefront">
          <div className="space-y-4">
            <div>
              <Label>Order types customers can choose</Label>
              <div className="mt-1 flex gap-2">
                {(["pickup", "delivery"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                      enabledTypes.has(t)
                        ? "border-yellow-400 bg-yellow-400/15 text-stone-950 dark:text-white"
                        : "border-black/15 text-stone-500 dark:border-white/15 dark:text-stone-400"
                    }`}
                  >
                    {enabledTypes.has(t) ? "✓ " : ""}
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                Only the enabled types appear in the customer&apos;s cart.
              </p>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value="Asia/Kolkata (IST)" disabled readOnly />
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                All dates &amp; times across the app use India Standard Time.
              </p>
            </div>
            <div>
              <Label>Order alerts</Label>
              <Button type="button" variant="outline" onClick={sendTest} loading={testing} className="w-full">
                Send test notification
              </Button>
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                Enable alerts with the bell icon in the top bar first. The push contact email comes from the Email
                field above.
              </p>
            </div>
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
