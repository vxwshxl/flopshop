/**
 * Order detail pages are reached from several places (the orders list, a
 * customer's profile, a delivery partner's queue…), so the back link follows a
 * `?from=` hint instead of always pointing at the orders list. The hint is
 * matched against a fixed allowlist — never followed as an arbitrary URL.
 */
export type BackLink = { href: string; label: string };

const UUID = "[0-9a-fA-F-]{36}";

/** Back target for `/admin/orders/[id]`. */
export function adminOrderBackLink(from?: string): BackLink {
  if (from && new RegExp(`^/admin/customers/${UUID}$`).test(from)) {
    return { href: from, label: "Back to customer" };
  }
  if (from && new RegExp(`^/admin/users/${UUID}$`).test(from)) {
    return { href: from, label: "Back to user" };
  }
  return { href: "/admin/orders", label: "Back to orders" };
}

/** Back target for the storefront `/orders/[id]`, also used by delivery partners. */
export function storeOrderBackLink(from?: string): BackLink {
  if (from === "delivery") return { href: "/delivery", label: "Back to deliveries" };
  return { href: "/orders", label: "Back to orders" };
}
