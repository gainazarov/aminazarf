import { supabase } from "@/lib/supabaseClient";

type SeedResult = {
  category: { id: number; name: string; slug: string };
  product: {
    id: number;
    name: string;
    category_id: number | null;
    in_stock: boolean;
    price: number | null;
    image: string | null;
  };
};

export async function seedTestCategoryAndProduct(): Promise<SeedResult> {
  // Note: RLS must allow inserts for anon if you're running this from the browser.
  // For a safe setup, run inserts from server-side with service_role (not used here).

  const seedCategory = {
    name: "Тестовая категория",
    slug: "test-category",
  };

  // Upsert category by unique slug
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .upsert(seedCategory, { onConflict: "slug" })
    .select("id,name,slug")
    .single();

  if (categoryError || !category) {
    throw categoryError ?? new Error("Failed to upsert category");
  }

  const seedProduct = {
    name: "Тестовый товар",
    category_id: category.id,
    in_stock: true,
    price: 99.99,
    image: "/images/ceramics.jpg",
  };

  // Try to keep it idempotent: if a product with same name in this category exists, reuse it.
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id,name,category_id,in_stock,price,image")
    .eq("category_id", category.id)
    .eq("name", seedProduct.name)
    .limit(1);

  if (existingError) throw existingError;

  const existingProduct = existing?.[0];
  if (existingProduct) {
    return { category, product: existingProduct };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert(seedProduct)
    .select("id,name,category_id,in_stock,price,image")
    .single();

  if (productError || !product) {
    throw productError ?? new Error("Failed to insert product");
  }

  return { category, product };
}
