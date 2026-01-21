import { useQuery } from "@tanstack/react-query";
import {
  products,
  getProductsByCategorySlug,
  type Product,
} from "@/data/catalog";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => products,
  });
}

export function useProductsByCategory(slug: string | null) {
  return useQuery({
    queryKey: ["productsByCategory", slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return [] as Product[];
      return getProductsByCategorySlug(slug);
    },
  });
}
