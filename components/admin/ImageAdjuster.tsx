"use client";

import { useRef } from "react";
import Image from "next/image";
import { AlignCenterHorizontal, AlignCenterVertical, Crosshair, RotateCcw } from "lucide-react";

export type ImagePosition = { x: number; y: number; scale: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * 4:5 image framing tool: drag to pan, slider to zoom (crop), rule-of-thirds
 * grid overlay, and quick-center buttons. Emits an object-position + scale that
 * the storefront applies via `imagePositionStyle`.
 */
export function ImageAdjuster({
  src,
  value,
  onChange,
}: {
  src: string;
  value: ImagePosition;
  onChange: (next: ImagePosition) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, px: value.x, py: value.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const box = boxRef.current;
    if (!box) return;
    const { width, height } = box.getBoundingClientRect();
    // Drag distance as a % of the box; subtract so the image follows the cursor.
    const dx = ((e.clientX - drag.current.startX) / width) * 100;
    const dy = ((e.clientY - drag.current.startY) / height) * 100;
    onChange({
      ...value,
      x: clamp(drag.current.px - dx, 0, 100),
      y: clamp(drag.current.py - dy, 0, 100),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  return (
    <div className="flex flex-col items-stretch gap-3">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-[4/5] w-full cursor-grab touch-none overflow-hidden rounded-xl border border-[#333] bg-[#0a0a0a] active:cursor-grabbing"
      >
        <Image
          src={src}
          alt="preview"
          fill
          draggable={false}
          sizes="320px"
          style={{
            objectFit: "cover",
            objectPosition: `${value.x}% ${value.y}%`,
            transform: value.scale !== 1 ? `scale(${value.scale})` : undefined,
            transformOrigin: `${value.x}% ${value.y}%`,
          }}
        />
        {/* Rule-of-thirds grid overlay. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.28) 1px, transparent 1px)," +
              "linear-gradient(to bottom, rgba(255,255,255,0.28) 1px, transparent 1px)",
            backgroundSize: "33.3333% 33.3333%",
          }}
        />
      </div>

      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-gray-400">
          <span>Zoom / crop</span>
          <span>{value.scale.toFixed(2)}×</span>
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={value.scale}
          onChange={(e) => onChange({ ...value, scale: Number(e.target.value) })}
          className="w-full accent-yellow-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...value, x: 50 })}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#333] px-2 py-2 text-xs text-gray-300 hover:bg-white/5"
        >
          <AlignCenterVertical className="h-3.5 w-3.5" /> Center H
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, y: 50 })}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#333] px-2 py-2 text-xs text-gray-300 hover:bg-white/5"
        >
          <AlignCenterHorizontal className="h-3.5 w-3.5" /> Center V
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, x: 50, y: 50 })}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#333] px-2 py-2 text-xs text-gray-300 hover:bg-white/5"
        >
          <Crosshair className="h-3.5 w-3.5" /> Center
        </button>
        <button
          type="button"
          onClick={() => onChange({ x: 50, y: 50, scale: 1 })}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#333] px-2 py-2 text-xs text-gray-300 hover:bg-white/5"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-500">Drag the image to reposition</p>
    </div>
  );
}
