"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { setOnlineStatusAction, heartbeatAction } from "@/app/delivery/actions";

const HEARTBEAT_MS = 60_000; // 1 minute

/**
 * Online/offline toggle for delivery partners.
 * When online, sends a heartbeat every 60 s so the admin knows they're active.
 */
export function OnlineToggle({ initialOnline }: { initialOnline: boolean }) {
  const [online, setOnline] = useState(initialOnline);
  const [pending, setPending] = useState(false);

  const toggle = useCallback(async () => {
    const next = !online;
    setPending(true);
    try {
      const res = await setOnlineStatusAction(next);
      if (res.ok) {
        setOnline(next);
        toast.success(next ? "You're online — orders will appear" : "You're offline");
      } else {
        toast.error(res.error ?? "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPending(false);
    }
  }, [online]);

  // Heartbeat while online
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => {
      heartbeatAction();
    }, HEARTBEAT_MS);
    // Send one immediately on mount
    heartbeatAction();
    return () => clearInterval(id);
  }, [online]);

  // Go offline on page unload
  useEffect(() => {
    const onUnload = () => {
      if (online) {
        // best-effort — sendBeacon doesn't work with server actions,
        // but the heartbeat will timeout on the admin side after 5 min.
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [online]);

  return (
    <button
      disabled={pending}
      onClick={toggle}
      className="group flex items-center gap-2.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
      style={{
        borderColor: online ? "rgba(245,197,24,0.4)" : "rgba(255,255,255,0.1)",
        background: online ? "rgba(245,197,24,0.1)" : "rgba(255,255,255,0.03)",
      }}
    >
      <span className="relative flex h-2.5 w-2.5">
        {online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
        )}
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: online ? "#f5c518" : "#555" }}
        />
      </span>
      <span style={{ color: online ? "#f5c518" : "rgba(255,255,255,0.5)" }}>
        {pending ? "..." : online ? "Online" : "Offline"}
      </span>
    </button>
  );
}
