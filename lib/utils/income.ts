import type { IncomeMethod } from "@/lib/types";

/** Income payment-method buckets, in display order. Keys match the income
 *  aggregation in Reports and the method_transfer_legs `method` values. */
export const INCOME_METHODS: { key: IncomeMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "bank", label: "Bank Transfer" },
  { key: "credit", label: "Wallet/Credit" },
  { key: "other", label: "Other" },
];

export const INCOME_METHOD_LABEL: Record<IncomeMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  credit: "Wallet/Credit",
  other: "Other",
};
