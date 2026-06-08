"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Hostel } from "@/lib/types";

function isMissingProfile(profile: { phone: string | null; room_number: string | null; hostel_block: string | null }) {
  return !profile.phone?.trim() || !profile.room_number?.trim() || !profile.hostel_block?.trim();
}

export function ProfileCompletionPrompt({ hostels }: { hostels: Hostel[] }) {
  const { profile, isAuthenticated, loading } = useUser();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: "", room_number: "", hostel_block: "" });
  const router = useRouter();

  useEffect(() => {
    if (loading || !isAuthenticated || !profile) return;
    
    const missing = isMissingProfile(profile);
    if (missing) {
      setForm({
        phone: profile.phone ?? "",
        room_number: profile.room_number ?? "",
        hostel_block: profile.hostel_block ?? "",
      });
      setOpen(true);
    }
  }, [profile, isAuthenticated, loading]);

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!form.phone.trim() || !form.room_number.trim() || !form.hostel_block.trim()) {
      return toast.error("Please enter your phone, room number, and select a hostel.");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: form.phone.trim(),
          room_number: form.room_number.trim(),
          hostel_block: form.hostel_block.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Profile completed.");
        setOpen(false);
        setTimeout(() => {
          router.refresh();
        }, 50);
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthenticated || loading || !profile) return null;

  return (
    <Modal open={open} onClose={() => {}} title="Complete your delivery details">
      <p className="mb-4 text-sm text-white/70">
        Delivery orders need a phone number, room number, and hostel. Fill them in now so your orders can be fulfilled.
      </p>
      <form onSubmit={save} className="space-y-4">
        <div>
          <Label htmlFor="complete-phone">Phone</Label>
          <Input id="complete-phone" value={form.phone} onChange={setField("phone")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="complete-room">Room No.</Label>
            <Input id="complete-room" value={form.room_number} onChange={setField("room_number")} />
          </div>
          <div>
            <Label htmlFor="complete-hostel">Hostel</Label>
            <Select value={form.hostel_block} onChange={setField("hostel_block")}>
              <option value="">Select hostel</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit" loading={saving}>
            Save details
          </Button>
        </div>
      </form>
    </Modal>
  );
}
