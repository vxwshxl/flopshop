import Link from "next/link";
import { Lock } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <StatusPage
      code="401"
      title="Sign in required"
      message="You need to be signed in to view this page."
      icon={<Lock className="h-10 w-10" strokeWidth={2.2} />}
      action={
        <Link
          href="/login"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Sign in
        </Link>
      }
    />
  );
}
