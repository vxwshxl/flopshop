import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductBuyers, type BuyerRow } from "@/components/admin/ProductBuyers";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();
  const [{ data: product }, { data: categories }, { data: lines }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").order("sort_order"),
    // Every order line for this product, with its order's customer details.
    supabase
      .from("order_items")
      .select(
        "quantity, total_price, orders!inner(id, order_number, customer_name, customer_phone, customer_room, created_at, status, is_manual)"
      )
      .eq("product_id", id),
  ]);

  if (!product) notFound();

  type LineRow = {
    quantity: number;
    total_price: number;
    orders: {
      id: string;
      order_number: string;
      customer_name: string;
      customer_phone: string | null;
      customer_room: string | null;
      created_at: string;
      status: BuyerRow["status"];
      is_manual: boolean;
    };
  };

  const buyers: BuyerRow[] = ((lines ?? []) as unknown as LineRow[])
    .map((l) => ({
      order_id: l.orders.id,
      order_number: l.orders.order_number,
      customer_name: l.orders.customer_name,
      customer_phone: l.orders.customer_phone,
      customer_room: l.orders.customer_room,
      created_at: l.orders.created_at,
      status: l.orders.status,
      is_manual: l.orders.is_manual,
      quantity: l.quantity,
      total_price: l.total_price,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Product"
        subtitle={(product as Product).name}
        action={
          <Link href="/admin/products/new">
            <Button variant="dark">
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </Link>
        }
      />
      <ProductForm categories={(categories as Category[]) ?? []} product={product as Product} />
      <ProductBuyers buyers={buyers} currency={settings.currency_symbol} />
    </div>
  );
}
