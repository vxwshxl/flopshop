import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — FlopShop",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-stone-950">
        <h1 className="mb-4 text-3xl font-extrabold text-stone-950 dark:text-white">Terms of Service</h1>
        <p className="mb-6 text-stone-600 dark:text-stone-400">
          Welcome to FlopShop. These terms govern your use of the app, ordering process, and customer responsibilities.
        </p>
        <div className="space-y-4 text-stone-700 dark:text-stone-200">
          <section>
            <h2 className="mb-2 text-xl font-semibold">Order acceptance</h2>
            <p>
              All orders are subject to availability and confirmation. FlopShop may cancel or modify orders if items are out of stock or unavailable.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">Pricing and payment</h2>
            <p>
              Prices include only the selected items, delivery fees, and any applicable taxes. Payment is processed through the selected method at checkout.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">User conduct</h2>
            <p>
              Users should provide accurate information and comply with any applicable policies. Misuse of the service may result in account suspension.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold">Liability</h2>
            <p>
              FlopShop is not responsible for delayed deliveries or issues caused by incorrect contact information supplied during checkout.
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
