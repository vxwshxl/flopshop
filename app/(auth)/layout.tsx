import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-amber-50 px-4">
      <Link href="/" className="mb-6 flex items-center gap-2 text-2xl font-extrabold text-gray-900">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">
          🛒
        </span>
        FlopShop
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        {children}
      </div>
    </div>
  );
}
