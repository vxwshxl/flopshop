import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the "middleware" convention to "proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, image files, and the
     * /auth/* routes. The auth routes (signout, OAuth callback) write session
     * cookies themselves; running the session-refreshing proxy on them re-sets
     * the auth cookie and clobbers sign-out's deletion, so the user never
     * actually gets logged out.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
