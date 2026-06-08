"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { Profile, Hostel } from "@/lib/types";

export function ProfileView({ profile, hostels }: { profile: Profile; hostels: Hostel[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    room_number: profile.room_number ?? "",
    hostel_block: profile.hostel_block ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        phone: form.phone || null,
        room_number: form.room_number || null,
        hostel_block: form.hostel_block || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-white">Your Profile</h1>
      <p className="mb-5 text-sm text-white/50">{profile.email}</p>

      <form onSubmit={save} className="glass space-y-4 rounded-2xl p-5">
        <div>
          <Label>Full name</Label>
          <Input value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <Label>Room No.</Label>
            <Input value={form.room_number} onChange={set("room_number")} />
          </div>
        </div>
        <div>
          <Label>Hostel</Label>
          <Select value={form.hostel_block} onChange={set("hostel_block")}>
            <option value="">Select hostel</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.name}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="text-white/50">Account</span>
          <span className="font-semibold capitalize text-white">{profile.role}</span>
        </div>
        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
      </form>
    </div>
  );
}
