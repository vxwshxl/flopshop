/**
 * Shared skeleton for every admin page. Admin routes are `force-dynamic`, so
 * without a Suspense boundary here the router waits for the server render
 * before committing — clicks felt dead for a beat. This lets the navigation
 * commit immediately and paints a placeholder while the data lands.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-52 rounded-lg bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-36 rounded bg-black/5 dark:bg-white/5" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="glass h-48 rounded-2xl" />
          <div className="glass h-64 rounded-2xl" />
        </div>
        <div className="glass h-80 rounded-2xl" />
      </div>
    </div>
  );
}
