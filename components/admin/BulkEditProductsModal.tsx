"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { chunked } from "@/lib/utils/batch";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Product } from "@/lib/types";

/** How a field's amount is folded into each product's current value. */
type Op = "set" | "add" | "sub" | "pct";

type FieldState = { on: boolean; op: Op; value: string };

type Patch = {
  selling_price?: number;
  cost_price?: number;
  current_stock?: number;
  minimum_stock?: number;
  is_active?: boolean;
};

const blank: FieldState = { on: false, op: "set", value: "" };

const opLabel: Record<Op, string> = {
  set: "Set to",
  add: "Increase by",
  sub: "Decrease by",
  pct: "Change by %",
};

function applyOp(current: number, op: Op, amount: number): number {
  switch (op) {
    case "set":
      return amount;
    case "add":
      return current + amount;
    case "sub":
      return current - amount;
    case "pct":
      return current * (1 + amount / 100);
  }
}

/** Prices are DECIMAL(10,2) and can't go negative. */
const money = (n: number) => Math.max(0, Math.round(n * 100) / 100);
/** Stock is a whole count; a bulk "decrease by" stops at empty, not at debt. */
const count = (n: number) => Math.max(0, Math.round(n));

/** The typed amount, or null while the field is off or not yet a number. */
function amountOf(f: FieldState): number | null {
  if (!f.on) return null;
  const n = Number(f.value);
  return f.value.trim() === "" || !Number.isFinite(n) ? null : n;
}

/**
 * Edits one field — or several at once — across every selected product.
 *
 * Each row is opt-in: an unticked field is left exactly as it is, so raising
 * prices can't quietly reset stock. Amounts are relative as well as absolute
 * ("increase by ₹5", "change by 10%") because that's how a shelf-wide price
 * change is actually decided, and a preview shows the real before → after
 * numbers before anything is written.
 */
export function BulkEditProductsModal({
  open,
  products,
  currency,
  onClose,
  onDone,
}: {
  open: boolean;
  products: Product[];
  currency: string;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${products.length} product${products.length === 1 ? "" : "s"}`}
      className="max-w-xl"
    >
      {/* State lives in the inner component, which unmounts with the modal —
          so every open starts from a clean form rather than the last edit. */}
      <BulkEditFields products={products} currency={currency} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}

function BulkEditFields({
  products,
  currency,
  onClose,
  onDone,
}: {
  products: Product[];
  currency: string;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  const [price, setPrice] = useState(blank);
  const [cost, setCost] = useState(blank);
  const [stock, setStock] = useState(blank);
  const [minStock, setMinStock] = useState(blank);
  const [status, setStatus] = useState({ on: false, value: "active" });
  const [saving, setSaving] = useState(false);

  const priceAmt = amountOf(price);
  const costAmt = amountOf(cost);
  const stockAmt = amountOf(stock);
  const minAmt = amountOf(minStock);

  // A field that's ticked but still empty isn't ready — better to grey out
  // Apply than to write a silent no-op the admin thinks landed.
  const incomplete =
    (price.on && priceAmt === null) ||
    (cost.on && costAmt === null) ||
    (stock.on && stockAmt === null) ||
    (minStock.on && minAmt === null);

  // Only products the edit actually moves. A product already at the target
  // price isn't rewritten, and the Apply count is what will really change.
  const changes = useMemo(() => {
    const out: { product: Product; patch: Patch; notes: string[] }[] = [];
    for (const p of products) {
      const patch: Patch = {};
      const notes: string[] = [];

      if (priceAmt !== null) {
        const v = money(applyOp(p.selling_price, price.op, priceAmt));
        if (v !== p.selling_price) {
          patch.selling_price = v;
          notes.push(`${formatCurrency(p.selling_price, currency)} → ${formatCurrency(v, currency)}`);
        }
      }
      if (costAmt !== null) {
        const v = money(applyOp(p.cost_price, cost.op, costAmt));
        if (v !== p.cost_price) {
          patch.cost_price = v;
          notes.push(`cost ${formatCurrency(p.cost_price, currency)} → ${formatCurrency(v, currency)}`);
        }
      }
      if (stockAmt !== null) {
        const v = count(applyOp(p.current_stock, stock.op, stockAmt));
        if (v !== p.current_stock) {
          patch.current_stock = v;
          notes.push(`stock ${p.current_stock} → ${v}`);
        }
      }
      if (minAmt !== null) {
        const v = count(applyOp(p.minimum_stock, minStock.op, minAmt));
        if (v !== p.minimum_stock) {
          patch.minimum_stock = v;
          notes.push(`low-stock alert ${p.minimum_stock} → ${v}`);
        }
      }
      if (status.on) {
        const v = status.value === "active";
        if (v !== p.is_active) {
          patch.is_active = v;
          notes.push(v ? "→ Active" : "→ Hidden");
        }
      }

      if (notes.length) out.push({ product: p, patch, notes });
    }
    return out;
  }, [products, currency, price, cost, stock, minStock, status, priceAmt, costAmt, stockAmt, minAmt]);

  async function apply() {
    if (!changes.length) return;
    setSaving(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    // Products landing on identical values are written together, so a
    // percentage raise across sixty rows is a handful of requests, not sixty.
    const groups = new Map<string, { patch: Patch; ids: string[] }>();
    for (const c of changes) {
      const key = JSON.stringify(c.patch);
      const group = groups.get(key) ?? { patch: c.patch, ids: [] };
      group.ids.push(c.product.id);
      groups.set(key, group);
    }

    try {
      for (const group of groups.values()) {
        for (const batch of chunked(group.ids, 100)) {
          const { error } = await supabase
            .from("products")
            .update({ ...group.patch, updated_at: now })
            .in("id", batch);
          if (error) throw error;
        }
      }
      toast.success(`Updated ${changes.length} product${changes.length === 1 ? "" : "s"}.`);
      onDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update products.");
      // Earlier groups may already be written — refresh so the table shows
      // what actually landed instead of leaving stale numbers on screen.
      onDone(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        Tick a field to change it. Anything left unticked stays as it is.
      </p>

      <div className="space-y-2.5">
        <FieldRow
          label="Selling price"
          unit={currency}
          field={price}
          onField={setPrice}
          ops={["set", "add", "sub", "pct"]}
        />
        <FieldRow
          label="Cost price"
          unit={currency}
          field={cost}
          onField={setCost}
          ops={["set", "add", "sub", "pct"]}
          hint="Overwrites the weighted average that purchases keep up to date."
        />
        <FieldRow label="Stock" field={stock} onField={setStock} ops={["set", "add", "sub"]} step="1" />
        <FieldRow
          label="Low-stock alert"
          field={minStock}
          onField={setMinStock}
          ops={["set", "add", "sub"]}
          step="1"
        />

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-40 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-white/85">
            <input
              type="checkbox"
              checked={status.on}
              onChange={(e) => setStatus((s) => ({ ...s, on: e.target.checked }))}
              className="h-4 w-4 cursor-pointer accent-yellow-400"
            />
            Status
          </label>
          <Select
            value={status.value}
            onChange={(e) => setStatus((s) => ({ ...s, value: e.target.value }))}
            disabled={!status.on}
            className="w-36"
          >
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
          </Select>
        </div>
      </div>

      <Preview changes={changes} incomplete={incomplete} total={products.length} />

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={apply} loading={saving} disabled={incomplete || changes.length === 0}>
          {changes.length === 0
            ? "Apply"
            : `Apply to ${changes.length} product${changes.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  unit,
  field,
  onField,
  ops,
  step = "0.01",
  hint,
}: {
  label: string;
  unit?: string;
  field: FieldState;
  onField: (next: FieldState) => void;
  ops: Op[];
  step?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex w-40 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-white/85">
          <input
            type="checkbox"
            checked={field.on}
            onChange={(e) => onField({ ...field, on: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-yellow-400"
          />
          {label}
        </label>
        <Select
          value={field.op}
          onChange={(e) => onField({ ...field, op: e.target.value as Op })}
          disabled={!field.on}
          className="w-36"
        >
          {ops.map((op) => (
            <option key={op} value={op}>
              {opLabel[op]}
            </option>
          ))}
        </Select>
        <div className="relative flex-1 sm:max-w-[9rem]">
          <Input
            type="number"
            step={field.op === "pct" ? "0.1" : step}
            value={field.value}
            onChange={(e) => onField({ ...field, value: e.target.value })}
            disabled={!field.on}
            aria-label={`${label} amount`}
            placeholder="0"
            className={field.op === "pct" || unit ? "pr-7" : undefined}
          />
          {(field.op === "pct" || unit) && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
              {field.op === "pct" ? "%" : unit}
            </span>
          )}
        </div>
      </div>
      {hint && field.on && <p className="mt-1 pl-6 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

/** What the current settings would actually do, named product by product. */
function Preview({
  changes,
  incomplete,
  total,
}: {
  changes: { product: Product; notes: string[] }[];
  incomplete: boolean;
  total: number;
}) {
  const shown = changes.slice(0, 4);

  return (
    <div className="glass-line rounded-lg border p-3 text-xs">
      {incomplete ? (
        <p className="text-white/50">Enter an amount for every ticked field.</p>
      ) : changes.length === 0 ? (
        <p className="text-white/50">
          Nothing to change — tick a field, or these {total} product
          {total === 1 ? " is" : "s are"} already at those values.
        </p>
      ) : (
        <ul className="space-y-1">
          {shown.map(({ product, notes }) => (
            <li key={product.id} className="flex flex-wrap gap-x-2 text-white/70">
              <span className="font-medium text-white">{product.name}</span>
              <span className="text-white/50">{notes.join(" · ")}</span>
            </li>
          ))}
          {changes.length > shown.length && (
            <li className="text-white/40">and {changes.length - shown.length} more…</li>
          )}
        </ul>
      )}
    </div>
  );
}
