import { Wrench } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export const dynamic = "force-dynamic";

// Served with a 503 status when MAINTENANCE_MODE is enabled (see middleware).
export default function MaintenancePage() {
  return (
    <StatusPage
      code="503"
      title="Down for maintenance"
      message="The shop is temporarily unavailable while we make some improvements. Please check back shortly."
      icon={<Wrench className="h-10 w-10" strokeWidth={2.2} />}
      action={<span className="text-sm text-white/40">We&apos;ll be back soon.</span>}
    />
  );
}
