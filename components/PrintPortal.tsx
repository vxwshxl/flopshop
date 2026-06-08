"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into a `.print-portal` node appended directly to <body>.
 * This isolates the printable invoice from the app shell: during print we hide
 * every other body child, so the page contains *only* the invoice and fits on a
 * single sheet (no blank trailing page from the tall, hidden admin/store UI).
 * Hidden on screen — it exists purely as the print source.
 */
export function PrintPortal({ children }: { children: React.ReactNode }) {
  // Lazily create the host node on the client; null during SSR.
  const [node] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "print-portal";
    return el;
  });

  useEffect(() => {
    if (!node) return;
    document.body.appendChild(node);
    return () => node.remove();
  }, [node]);

  return node ? createPortal(children, node) : null;
}
