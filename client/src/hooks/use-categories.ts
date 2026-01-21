import { useQuery } from "@tanstack/react-query";
import { categories } from "@/data/catalog";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => categories,
  });
}
