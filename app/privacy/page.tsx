import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="inline-block">
          <Brand textClassName="text-xl" />
        </Link>

        <h1 className="mt-10 text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/40">Last updated {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="mb-1 text-base font-semibold text-white">Information we collect</h2>
            <p>
              When you sign in with Google we store your name, email and profile photo. When you place an
              order we store your name, phone, room number and order details so we can prepare and deliver it.
            </p>
          </section>
          <section>
            <h2 className="mb-1 text-base font-semibold text-white">How we use it</h2>
            <p>
              Your information is used only to process orders, arrange pickup or delivery, and show you your
              order history. We never sell your personal data.
            </p>
          </section>
          <section>
            <h2 className="mb-1 text-base font-semibold text-white">Third-party services</h2>
            <p>Authentication is handled by Google; data is stored with Supabase.</p>
          </section>
          <section>
            <h2 className="mb-1 text-base font-semibold text-white">Contact</h2>
            <p>
              Questions? Message us on WhatsApp at{" "}
              <a
                href="https://wa.me/918133860088"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-400 hover:underline"
              >
                +91 81338 60088
              </a>
              .
            </p>
          </section>
        </div>

        <Link href="/" className="mt-10 inline-block text-sm text-white/50 hover:text-white">
          ← Back to shop
        </Link>
      </div>
    </div>
  );
}
