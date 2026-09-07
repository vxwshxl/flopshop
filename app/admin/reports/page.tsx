import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { ReportsView } from "@/components/admin/ReportsView";
import { buildCreditSources, type LedgerRow } from "@/lib/utils/income";
import { computeCashDrift } from "@/lib/utils/cash-drift";
import type { Category, MethodTransfer, Product, Purchase, Shareholder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  // `orders`, `purchases` and `wallet_transactions` are the ledger-sized tables
  // here — every figure on this page is a sum over all of them, so they go
  // through `fetchAllRows` rather than stopping at PostgREST's 1000-row cap.
  // The rest are small reference tables; one round trip each is right.
  const [
    orders,
    { data: products },
    purchases,
    { data: categories },
    { data: shareholders },
    { data: settlements },
    { data: transfers },
    walletTxns,
  ] = await Promise.all([
    fetchAllRows<unknown>((from, to) =>
      supabase
        .from("orders")
        .select(
          "id, status, order_type, created_at, subtotal, total_amount, delivery_fee, delivery_person_earning, admin_delivery_earning, payment_method, paid_cash, paid_upi, order_items(quantity, total_price, product_name, cost_price, product:products(category_id))"
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    ),
    supabase.from("products").select("*").order("name"),
    fetchAllRows<Purchase>((from, to) =>
      supabase.from("purchases").select("*").order("id").range(from, to)
    ),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("shareholders").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("shareholder_settlements")
      .select("shareholder_id, settled_through, carry_forward")
      .order("settled_through", { ascending: false }),
    supabase
      .from("method_transfers")
      .select("*, legs:method_transfer_legs(*)")
      .order("date", { ascending: false }),
    // The whole wallet ledger — used to trace credit-paid orders back to the
    // cash/UPI that originally funded those wallets, and to spot cash paid out
    // of the drawer against credit the shop was paid for by UPI/bank. The
    // second reading walks each wallet in time order, hence the date sort.
    fetchAllRows<LedgerRow & { created_at: string }>((from, to) =>
      supabase
        .from("wallet_transactions")
        .select("order_id, wallet_id, amount, type, method, created_at")
        .order("created_at", { ascending: true })
        .order("id")
        .range(from, to)
    ),
  ]);

  // Credit-paid orders traced back to the cash/UPI that funded the wallet, for
  // the Reports "by source" income view.
  const creditSources = buildCreditSources(walletTxns);

  // Cash that left the drawer to repay UPI/bank-funded credit and hasn't been
  // squared off with an Income Transfer yet.
  const cashDrift = computeCashDrift(walletTxns, (transfers as MethodTransfer[]) ?? []);

  // Each shareholder's most recent cutoff → their outstanding profit since then,
  // plus the change that settlement left unpaid (partial settlement).
  const cutoffById: Record<string, string> = {};
  const carryById: Record<string, number> = {};
  const settlementRows =
    (settlements as
      | { shareholder_id: string; settled_through: string; carry_forward: number | string }[]
      | null) ?? [];
  for (const s of settlementRows) {
    if (!cutoffById[s.shareholder_id]) {
      cutoffById[s.shareholder_id] = s.settled_through;
      carryById[s.shareholder_id] = Number(s.carry_forward ?? 0);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, profit & inventory analytics" />
      <ReportsView
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders={orders as any}
        products={(products as Product[]) ?? []}
        purchases={purchases}
        categories={(categories as Category[]) ?? []}
        settings={settings}
        shareholders={(shareholders as Shareholder[]) ?? []}
        cutoffById={cutoffById}
        carryById={carryById}
        transfers={(transfers as MethodTransfer[]) ?? []}
        creditSources={creditSources}
        cashDrift={cashDrift}
      />
    </div>
  );
}
