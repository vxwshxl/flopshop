import { ShieldX } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="Access forbidden"
      message="You don't have permission to view this page. If you think this is a mistake, contact the shop admin."
      icon={<ShieldX className="h-10 w-10" strokeWidth={2.2} />}
    />
  );
}
