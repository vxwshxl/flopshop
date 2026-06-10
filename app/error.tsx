"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error for logging/observability.
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="500"
      title="Something went wrong"
      message="An unexpected error occurred on our end. Please try again in a moment."
      icon={<AlertTriangle className="h-10 w-10" strokeWidth={2.2} />}
      action={
        <>
          <button
            onClick={reset}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Back to shop
          </Link>
        </>
      }
    />
  );
}
