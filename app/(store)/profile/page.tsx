import { redirect } from "next/navigation";
import { getCurrentProfile, getActiveHostels } from "@/lib/supabase/queries";
import { ProfileView } from "@/components/store/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, hostels] = await Promise.all([getCurrentProfile(), getActiveHostels()]);
  if (!profile) redirect("/login?redirect=/profile");
  return <ProfileView profile={profile} hostels={hostels} />;
}
