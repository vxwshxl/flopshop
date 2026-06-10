import { Ban } from "lucide-react";

export const dynamic = "force-dynamic";

export default function BannedPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="glass w-full max-w-md rounded-3xl px-6 py-12 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-red-500/15 text-red-400">
          <Ban className="h-10 w-10" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Account banned</h1>
        <p className="mt-3 text-sm text-white/60">
          Your account has been suspended and can no longer access the shop. If you think this is a
          mistake, please contact the shop admin.
        </p>
        <form action="/auth/signout" method="post" className="mt-7">
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
