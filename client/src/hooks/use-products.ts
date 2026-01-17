import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

// Types derived from schema
type Product = z.infer<typeof api.products.list.responses[200]>[number];

export function useProducts() {
  return useQuery({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      const res = await fetch(api.products.list.path);
      if (!res.ok) throw new Error("Failed to fetch products");
      return api.products.list.responses[200].parse(await res.json());
    },
  });
}

export function useProductsByCategory(slug: string | null) {
  return useQuery({
    queryKey: [api.products.getByCategory.path, slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return [];
      const url = buildUrl(api.products.getByCategory.path, { slug });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch products for category: ${slug}`);
      return api.products.getByCategory.responses[200].parse(await res.json());
    },
  });
}
