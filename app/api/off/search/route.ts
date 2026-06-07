import { NextResponse } from "next/server";

// Proxy to OpenFoodFacts so the admin can pull real product details + images.
//   /api/off/search?q=maggi      → name search
//   /api/off/search?q=8901058...  → barcode lookup (all digits)

const UA = "FlopShop/1.0 (hostel snack shop; admin product import)";
const FIELDS =
  "code,product_name,brands,quantity,categories,image_front_url,image_front_small_url,image_url,ingredients_text,nutriments";

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_url?: string;
  ingredients_text?: string;
  nutriments?: Record<string, number | undefined>;
}

function normalize(p: OffProduct) {
  const n = p.nutriments ?? {};
  return {
    code: p.code ?? "",
    name: (p.product_name ?? "").trim(),
    brand: (p.brands ?? "").split(",")[0]?.trim() ?? "",
    quantity: p.quantity ?? "",
    categories: p.categories ?? "",
    ingredients: p.ingredients_text ?? "",
    image: p.image_front_url || p.image_url || p.image_front_small_url || null,
    nutrition: {
      energy_kcal: n["energy-kcal_100g"] ?? null,
      fat: n["fat_100g"] ?? null,
      carbs: n["carbohydrates_100g"] ?? null,
      sugars: n["sugars_100g"] ?? null,
      protein: n["proteins_100g"] ?? null,
      salt: n["salt_100g"] ?? null,
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const isBarcode = /^\d{6,}$/.test(q);

  try {
    if (isBarcode) {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=${FIELDS}`,
        { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
      );
      const data = await res.json();
      if (data.status !== 1 || !data.product) return NextResponse.json({ results: [] });
      return NextResponse.json({ results: [normalize(data.product)] });
    }

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      q
    )}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 0 } });
    const data = await res.json();
    const results = ((data.products ?? []) as OffProduct[])
      .map(normalize)
      .filter((r) => r.name && r.image);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "OpenFoodFacts lookup failed." }, { status: 502 });
  }
}
