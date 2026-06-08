"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "glass-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl",
          className
        )}
      >
        {title && (
          <div className="glass-line flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-stone-500 hover:bg-yellow-400 hover:text-black dark:text-stone-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
