export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  name: string;
  description?: string | null;
  price?: string | null;
  image: string;
  categoryId?: number | null;
};

export const categories: Category[] = [
  { id: 1, name: "Ceramics", slug: "ceramics" },
  { id: 2, name: "Glassware", slug: "glassware" },
  { id: 3, name: "Linens", slug: "linens" },
  { id: 4, name: "Decor", slug: "decor" },
];

export const products: Product[] = [
  {
    id: 1,
    name: "Artisan Clay Plate",
    description: "Hand-thrown ceramic plate with a raw edge finish.",
    price: "$45",
    image: "/images/ceramics.jpg",
    categoryId: 1,
  },
  {
    id: 2,
    name: "Stoneware Bowl",
    description: "Deep bowl for soups and stews, matte glaze.",
    price: "$38",
    image: "/images/ceramics.jpg",
    categoryId: 1,
  },
  {
    id: 3,
    name: "Crystal Wine Glass",
    description: "Lead-free crystal glass with a delicate stem.",
    price: "$60",
    image: "/images/glassware.jpg",
    categoryId: 2,
  },
  {
    id: 4,
    name: "Linen Table Runner",
    description: "100% organic linen in natural oatmeal color.",
    price: "$85",
    image: "/images/ceramics.jpg",
    categoryId: 3,
  },
  {
    id: 5,
    name: "Minimalist Vase",
    description: "Hand-blown glass vase for dry arrangements.",
    price: "$120",
    image: "/images/decor.jpg",
    categoryId: 4,
  },
];

export function getProductsByCategorySlug(slug: string): Product[] {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return [];
  return products.filter((p) => p.categoryId === category.id);
}
