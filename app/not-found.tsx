import { Compass } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      message="The page you're looking for doesn't exist or may have been moved."
      icon={<Compass className="h-10 w-10" strokeWidth={2.2} />}
    />
  );
}
