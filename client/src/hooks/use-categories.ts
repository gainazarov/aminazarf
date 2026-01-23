import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/data/catalog";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug")
        .order("name", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: number | string;
        name: string;
        slug: string;
      }>;

      return rows.map(
        (row): Category => ({
          id: Number(row.id),
          name: row.name,
          slug: row.slug,
        }),
      );
    },
  });
}
