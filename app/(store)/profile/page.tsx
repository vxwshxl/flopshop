import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { ProfileView } from "@/components/store/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirect=/profile");
  return <ProfileView profile={profile} />;
}
