"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

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

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "glass-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl",
          className
        )}
      >
        {title ? (
          <div className="glass-line flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-white/60 transition hover:bg-yellow-400 hover:text-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur transition hover:bg-yellow-400 hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
