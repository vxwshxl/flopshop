"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function safeRedirect(raw: string | null) {
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // fallback to root
  }
  return "/";
}

function LoginForm() {
  const params = useSearchParams();
  const redirect = safeRedirect(params.get("redirect"));
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const callbackOrigin = window.location.origin;
    const callbackUrl = new URL("/auth/callback", callbackOrigin);
    callbackUrl.searchParams.set("redirect", redirect);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
    // On success the browser is redirected to Google, so no further action here.
  }

  return (
    <div className="text-center">
      <h1 className="mb-1 text-2xl font-bold text-white">Welcome to FlopShop</h1>
      <p className="mb-8 text-sm text-white/60">
        Sign in with your Google account to order snacks and track deliveries.
      </p>

      <Button
        onClick={signInWithGoogle}
        loading={loading}
        variant="outline"
        size="lg"
        className="w-full gap-3"
      >
        {!loading && <GoogleIcon />}
        Continue with Google
      </Button>

      <p className="mt-6 text-xs text-white/40">
        Browsing & pickup don&apos;t need an account — sign in for room delivery and order history.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
