import { redirect } from "next/navigation";

// Auth is Google-only — there is no separate email signup.
// Preserve any redirect target and send users to the Google sign-in page.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: target } = await searchParams;
  redirect(`/login${target ? `?redirect=${encodeURIComponent(target)}` : ""}`);
}
