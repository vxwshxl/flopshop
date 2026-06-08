const ITEMS = [
  "Wear your cravings",
  "Snacks to your room",
  "Pickup is free",
  "Midnight cravings, delivered",
];

export function Marquee() {
  // Two identical tracks for a seamless -50% loop.
  const row = (
    <div className="marquee-track">
      {[...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS].map((t, i) => (
        <span key={i} className="mx-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-b border-white/10 bg-black py-2.5">
      <div className="flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
