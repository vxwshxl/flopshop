import { Brand } from "@/components/Brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="mb-6">
        <Brand href="/" textClassName="text-2xl" markClassName="h-10 w-10" />
      </div>
      <div className="glass-strong w-full max-w-md rounded-2xl p-8">{children}</div>
    </div>
  );
}
