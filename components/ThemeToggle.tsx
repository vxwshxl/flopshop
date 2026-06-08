"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ThemeMode = "system" | "light" | "dark";

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem("flopshop-theme") as ThemeMode | null;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("flopshop-theme") as ThemeMode | null;
    const initial = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    return initial === "dark" || (initial === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    applyTheme(mode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      const current = (window.localStorage.getItem("flopshop-theme") as ThemeMode | null) ?? "system";
      if (current === "system") setIsDark(applyTheme("system"));
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, [mode]);

  const nextMode: Exclude<ThemeMode, "system"> = isDark ? "light" : "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.setItem("flopshop-theme", nextMode);
        setMode(nextMode);
        setIsDark(applyTheme(nextMode));
      }}
      className={cn(
        "glass-lens grid h-9 w-9 place-items-center rounded-full text-stone-700 transition hover:text-stone-950 active:scale-95 dark:text-stone-200 dark:hover:text-white",
        className
      )}
      aria-label={`Switch to ${nextMode} mode`}
      title={`Switch to ${nextMode} mode`}
      suppressHydrationWarning
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function ThemeScript() {
  const code = `
    (() => {
      try {
        const mode = localStorage.getItem("flopshop-theme") || "system";
        const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
      } catch (_) {}
    })();
  `;

  return <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: code }} />;
}
