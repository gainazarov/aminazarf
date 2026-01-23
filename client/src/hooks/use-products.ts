import { useQuery } from "@tanstack/react-query";
import type { Product } from "@/data/catalog";
import { supabase } from "@/lib/supabaseClient";

type ProductRow = {
  id: number | string;
  name: string;
  price: unknown;
  image: string | null;
  category_id: number | string | null;
  in_stock?: boolean | null;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatPrice(price: unknown): string | null {
  if (price === null || price === undefined) return null;
  if (typeof price === "number" && Number.isFinite(price)) return price.toFixed(2);
  if (typeof price === "string" && price.trim().length > 0) return price;
  return String(price);
}

function mapProductRows(rows: ProductRow[]): Product[] {
  return rows.map(
    (row): Product => ({
      id: Number(row.id),
      name: row.name,
      price: formatPrice(row.price),
      image: row.image ?? "/images/ceramics.jpg",
      categoryId: row.category_id === null ? null : Number(row.category_id),
      inStock: row.in_stock ?? true,
    }),
  );
}

function clampPage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,image,category_id,in_stock")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as ProductRow[];
      return mapProductRows(rows);
    },
  });
}

export function useProductsPaged(page: number, pageSize: number) {
  const safePage = clampPage(page);
  const safePageSize = Math.max(1, Math.floor(pageSize));

  return useQuery({
    queryKey: ["productsPaged", safePage, safePageSize],
    queryFn: async (): Promise<PagedResult<Product>> => {
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      const { data, error, count } = await supabase
        .from("products")
        .select("id,name,price,image,category_id,in_stock", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const total = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / safePageSize));

      return {
        items: mapProductRows(((data ?? []) as ProductRow[]) ?? []),
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      };
    },
    staleTime: 10_000,
  });
}

export function useProductsByCategory(slug: string | null) {
  return useQuery({
    queryKey: ["productsByCategory", slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return [] as Product[];

      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!category) return [] as Product[];

      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,image,category_id,in_stock")
        .eq("category_id", (category as { id: number | string }).id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as ProductRow[];
      return mapProductRows(rows);
    },
  });
}

export function useProductsByCategoryPaged(
  slug: string | null,
  page: number,
  pageSize: number,
) {
  const safePage = clampPage(page);
  const safePageSize = Math.max(1, Math.floor(pageSize));

  return useQuery({
    queryKey: ["productsByCategoryPaged", slug, safePage, safePageSize],
    enabled: !!slug,
    queryFn: async (): Promise<PagedResult<Product>> => {
      if (!slug) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
        };
      }

      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!category) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
        };
      }

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      const { data, error, count } = await supabase
        .from("products")
        .select("id,name,price,image,category_id,in_stock", { count: "exact" })
        .eq("category_id", (category as { id: number | string }).id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const total = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / safePageSize));

      return {
        items: mapProductRows(((data ?? []) as ProductRow[]) ?? []),
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      };
    },
    staleTime: 10_000,
  });
}
