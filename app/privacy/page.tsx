import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — FlopShop",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-stone-950">
        <h1 className="mb-4 text-3xl font-extrabold text-stone-950 dark:text-white">Privacy Policy</h1>
        <p className="mb-6 text-stone-600 dark:text-stone-400">
          Your privacy matters to us. FlopShop only collects the information needed to process orders and provide a smooth checkout experience.
        </p>
        <div className="space-y-4 text-stone-700 dark:text-stone-200">
          <section>
            <h2 className="mb-2 text-xl font-semibold">Information we collect</h2>
            <p>
              We collect customer name, phone number, room number (for delivery), and order details to fulfill your request. Authentication data is managed by Google and Supabase.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">How we use it</h2>
            <p>
              Information is used to create and deliver orders, provide account access, and communicate order status. We do not sell your personal data.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">Third-party services</h2>
            <p>
              We use Google for authentication and Supabase for backend services. Please refer to their privacy policies for details on how they handle user data.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">Questions?</h2>
            <p>
              If you have questions about this policy, please contact the app owner or use the site’s support channels.
            </p>
          </section>
        </div>
        <p className="mt-8 text-sm text-stone-500 dark:text-stone-500">
          Back to <Link href="/" className="underline hover:text-stone-900 dark:hover:text-white">FlopShop</Link>.
        </p>
      </div>
    </div>
  );
}
