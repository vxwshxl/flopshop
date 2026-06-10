"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => {
    let val = e.target.value;
    if (k === "phone") {
      val = val.replace(/\D/g, "").slice(0, 10);
    }
    setForm((f) => ({ ...f, [k]: val }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Phone, room and hostel are mandatory — orders can't be delivered without them.
    if (!form.phone.trim() || !form.room_number.trim() || !form.hostel_block.trim()) {
      return toast.error("Please fill in your phone, room number, and hostel.");
    }
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name || null,
          phone: form.phone.trim(),
          room_number: form.room_number.trim(),
          hostel_block: form.hostel_block.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Unable to save profile.");
      } else {
        toast.success("Saved Changes");
        router.push("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
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
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={set("phone")} inputMode="numeric" />
          </div>
          <div>
            <Label>Room No. *</Label>
            <Input value={form.room_number} onChange={set("room_number")} />
          </div>
        </div>
        <div>
          <Label>Hostel *</Label>
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
          Complete Profile
        </Button>
      </form>
    </div>
  );
}
