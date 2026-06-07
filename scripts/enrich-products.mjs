// Best-effort: fetch a real image + nutrition from OpenFoodFacts for each
// seeded product and UPDATE the DB. Spaced out to respect OFF rate limits.
import { execSync } from "node:child_process";

const PSQL = "/Applications/Postgres.app/Contents/Versions/latest/bin/psql";
const CONN =
  "postgresql://postgres.lxpjbfeenounxnancxec:flopshop%402026@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
const UA = "FlopShop/1.0 (hostel snack shop; product enrichment)";
const FIELDS =
  "code,product_name,brands,quantity,categories,image_front_url,image_url,ingredients_text,nutriments";

// product name -> better OFF search term
const TERMS = {
  "Lay's Classic Salted": "Lays classic salted",
  "Kurkure Masala Munch": "Kurkure masala munch",
  "Dark Fantasy Choco": "Dark fantasy choco fills",
  "Haldiram Aloo Bhujia": "Haldiram aloo bhujia",
  "Coca-Cola 750ml": "Coca cola",
  "Sprite 750ml": "Sprite lemon",
  "Frooti Mango 250ml": "Frooti mango",
  "Red Bull 250ml": "Red bull energy",
  "Maggi 2-Min Noodles": "Maggi masala noodles",
  "Yippee Magic Masala": "Yippee magic masala noodles",
  "Top Ramen Curry": "Top ramen curry noodles",
  "Wai Wai Veg": "Wai wai noodles",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sqlEsc = (s) => String(s ?? "").replace(/'/g, "''");

function rows() {
  const out = execSync(
    `${PSQL} "${CONN}" -tAc "SELECT id || '~' || name FROM products WHERE image_url IS NULL ORDER BY name"`,
    { encoding: "utf8" }
  );
  return out.trim().split("\n").filter(Boolean).map((l) => {
    const [id, ...rest] = l.split("~");
    return { id, name: rest.join("~") };
  });
}

async function lookup(term) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    term
  )}&search_simple=1&action=process&json=1&page_size=8&fields=${FIELDS}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const data = await res.json();
  const hit = (data.products ?? []).find(
    (p) => (p.image_front_url || p.image_url) && p.product_name
  );
  if (!hit) return null;
  const n = hit.nutriments ?? {};
  return {
    image: hit.image_front_url || hit.image_url,
    details: {
      source: "openfoodfacts",
      off_code: hit.code ?? "",
      brand: (hit.brands ?? "").split(",")[0]?.trim() ?? "",
      quantity: hit.quantity ?? "",
      ingredients: hit.ingredients_text ?? "",
      categories: hit.categories ?? "",
      nutrition: {
        energy_kcal: n["energy-kcal_100g"] ?? null,
        fat: n["fat_100g"] ?? null,
        carbs: n["carbohydrates_100g"] ?? null,
        sugars: n["sugars_100g"] ?? null,
        protein: n["proteins_100g"] ?? null,
        salt: n["salt_100g"] ?? null,
      },
    },
  };
}

const products = rows();
let updated = 0;
for (const p of products) {
  const term = TERMS[p.name] ?? p.name;
  try {
    const found = await lookup(term);
    if (found?.image) {
      const sql = `UPDATE products SET image_url='${sqlEsc(found.image)}', details='${sqlEsc(
        JSON.stringify(found.details)
      )}'::jsonb WHERE id='${p.id}';`;
      execSync(`${PSQL} "${CONN}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: "ignore" });
      updated++;
      console.log(`✓ ${p.name}  →  ${found.image.split("/").pop()}`);
    } else {
      console.log(`· ${p.name}  (no image found)`);
    }
  } catch (e) {
    console.log(`✗ ${p.name}: ${e.message}`);
  }
  await sleep(20000); // OFF legacy search is aggressively rate-limited
}
console.log(`\nDone. Updated ${updated}/${products.length} products.`);
