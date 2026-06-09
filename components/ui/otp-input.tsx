"use client";

import * as React from "react";

/** 4 (or n) single-digit boxes with a numeric keypad, auto-advance, backspace
 *  to previous, and paste support. Controlled via a plain string value. */
export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[i]?.focus();

  function setDigit(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const arr = chars.slice();
    arr[i] = digit;
    onChange(arr.join("").slice(0, length));
    if (digit && i < length - 1) focus(i + 1);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[i] && i > 0) focus(i - 1);
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    onChange(text);
    focus(Math.min(text.length, length - 1));
  }

  return (
    <div className="flex justify-center gap-3">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={c}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-12 rounded-xl border border-white/15 bg-white/5 text-center text-2xl font-bold text-white focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
        />
      ))}
    </div>
  );
}
