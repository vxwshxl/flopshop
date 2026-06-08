"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/constants/dashboard";

export { DASHBOARD_RANGES, type DashboardRange };

export function DashboardRangeSelect({ value }: { value: DashboardRange }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "today") sp.delete("range");
    else sp.set("range", next);
    const qs = sp.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-44">
      {Object.entries(DASHBOARD_RANGES).map(([key, { label }]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
}
