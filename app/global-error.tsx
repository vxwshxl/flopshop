"use client";

import { useEffect } from "react";

// global-error replaces the root layout, so it must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black font-sans text-white">
        <div className="grid min-h-screen place-items-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-400">500</p>
            <h1 className="mt-1 text-2xl font-extrabold">Something went wrong</h1>
            <p className="mt-3 text-sm text-white/60">
              A critical error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="mt-7 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
