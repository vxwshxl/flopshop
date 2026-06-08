"use client";

import { usePathname, useRouter } from "next/navigation";
import { ToggleGroup, type ToggleOption } from "@/components/ui/toggle-group";
import { Clock, Package, Store } from "lucide-react";

export function DeliveryNav() {
  const pathname = usePathname();
  const router = useRouter();

  const options: ToggleOption[] = [
    { value: "/delivery", label: <><Package className="w-4 h-4" /> Active</> },
    { value: "/delivery/history", label: <><Clock className="w-4 h-4" /> History</> },
    { value: "/", label: <><Store className="w-4 h-4" /> Shop</> },
  ];

  return (
    <div className="flex justify-center mb-6">
      <ToggleGroup 
        options={options} 
        value={pathname} 
        onChange={(val) => router.push(val)} 
      />
    </div>
  );
}
