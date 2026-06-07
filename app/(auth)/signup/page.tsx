"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/";
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    room_number: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If a session is returned (email confirmation off), enrich the profile.
    if (data.session && data.user) {
      await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
          room_number: form.room_number || null,
        })
        .eq("id", data.user.id);
      setLoading(false);
      toast.success("Account created!");
      router.replace(redirect);
      router.refresh();
      return;
    }

    setLoading(false);
    toast.success("Check your email to confirm your account.");
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Create account</h1>
      <p className="mb-6 text-sm text-gray-500">Order snacks to your room in minutes.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={set("email")} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={set("password")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <Label htmlFor="room_number">Room</Label>
            <Input id="room_number" value={form.room_number} onChange={set("room_number")} />
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
