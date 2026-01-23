import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import imageCompression from "browser-image-compression";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
};

type ProductRow = {
  id: number;
  name: string;
  category_id: number | null;
  in_stock: boolean;
  price: number | null;
  image: string | null;
};

const NO_CATEGORY_VALUE = "__none__";
const PRODUCT_IMAGES_BUCKET = "product-images";

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

  try {
    const url = new URL(publicUrl);
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = url.pathname.slice(idx + marker.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    // Fallback for non-absolute URLs.
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    const path = publicUrl.slice(idx + marker.length);
    return path ? decodeURIComponent(path) : null;
  }
}

async function compressProductImage(file: File): Promise<File> {
  // Practical defaults for product photos: keep decent quality, limit dimensions and file size.
  // Uses a web worker to avoid blocking the UI.
  return await imageCompression(file, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.82,
    fileType: "image/jpeg",
  });
}

function toFiniteNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Invalid numeric value");
  return n;
}

function toNullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function getDbErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const maybe = error as { message?: unknown; code?: unknown; details?: unknown };

  const code = typeof maybe.code === "string" ? maybe.code : undefined;
  if (code === "23505") return "Значение уже существует (нарушено уникальное ограничение)";
  if (code === "23503") return "Некорректная ссылка (возможно, выбрана удалённая категория)";
  if (code === "23502") return "Не заполнены обязательные поля";

  if (typeof maybe.message === "string" && maybe.message.trim().length)
    return maybe.message;
  if (typeof maybe.details === "string" && maybe.details.trim().length)
    return maybe.details;

  return fallback;
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  const translit = input
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("");

  const base = translit
    .replace(/['\"]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || `category-${Date.now()}`;
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const pageSize = 20;
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);

  const [refreshing, setRefreshing] = useState(false);
  const lastCategoriesErrorAt = useRef<number>(0);
  const lastProductsErrorAt = useRef<number>(0);

  const categoriesQuery = useQuery({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug")
        .order("name", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as Array<{ id: unknown; name: string; slug: string }>;
      return rows.map((row) => ({
        id: toFiniteNumber(row.id),
        name: row.name,
        slug: row.slug,
      })) as CategoryRow[];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["adminProducts", productsPage, pageSize],
    queryFn: async () => {
      const from = (productsPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("products")
        .select("id,name,category_id,in_stock,price,image", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: unknown;
        name: string;
        category_id: unknown;
        in_stock: unknown;
        price: unknown;
        image: string | null;
      }>;

      const items = rows.map((row) => ({
        id: toFiniteNumber(row.id),
        name: row.name,
        category_id: toNullableFiniteNumber(row.category_id),
        in_stock: Boolean(row.in_stock),
        price: toNullableFiniteNumber(row.price),
        image: row.image ?? null,
      })) as ProductRow[];

      const total = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return { items, total, page: productsPage, pageSize, totalPages };
    },
  });

  const categoriesTotal = (categoriesQuery.data ?? []).length;
  const categoriesTotalPages = Math.max(1, Math.ceil(categoriesTotal / pageSize));
  const categoriesPageItems = (categoriesQuery.data ?? []).slice(
    (categoriesPage - 1) * pageSize,
    categoriesPage * pageSize,
  );

  const productsTotalPages = productsQuery.data?.totalPages;

  useEffect(() => {
    if (categoriesPage > categoriesTotalPages) setCategoriesPage(categoriesTotalPages);
  }, [categoriesPage, categoriesTotalPages]);

  useEffect(() => {
    if (!productsTotalPages) return;
    if (productsPage > productsTotalPages) setProductsPage(productsTotalPages);
  }, [productsPage, productsTotalPages]);

  useEffect(() => {
    if (!categoriesQuery.isError) return;
    if (categoriesQuery.errorUpdatedAt <= lastCategoriesErrorAt.current) return;
    lastCategoriesErrorAt.current = categoriesQuery.errorUpdatedAt;
    toast({
      variant: "destructive",
      title: "Ошибка",
      description: getDbErrorMessage(categoriesQuery.error, "Не удалось загрузить категории"),
    });
  }, [categoriesQuery.isError, categoriesQuery.errorUpdatedAt, categoriesQuery.error, toast]);

  useEffect(() => {
    if (!productsQuery.isError) return;
    if (productsQuery.errorUpdatedAt <= lastProductsErrorAt.current) return;
    lastProductsErrorAt.current = productsQuery.errorUpdatedAt;
    toast({
      variant: "destructive",
      title: "Ошибка",
      description: getDbErrorMessage(productsQuery.error, "Не удалось загрузить товары"),
    });
  }, [productsQuery.isError, productsQuery.errorUpdatedAt, productsQuery.error, toast]);

  const categoriesById = useMemo(() => {
    const map = new Map<number, CategoryRow>();
    (categoriesQuery.data ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [categoriesQuery.data]);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<CategoryRow | null>(
    null,
  );
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productEditing, setProductEditing] = useState<ProductRow | null>(null);
  const [productName, setProductName] = useState("");
  const [productCategoryId, setProductCategoryId] = useState<string>(NO_CATEGORY_VALUE);
  const [productInStock, setProductInStock] = useState(true);
  const [productPrice, setProductPrice] = useState<string>("");
  const [productImageUrl, setProductImageUrl] = useState<string>("");
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string>("");
  const [productImageOriginalBytes, setProductImageOriginalBytes] = useState<number | null>(
    null,
  );
  const [productImageCompressedBytes, setProductImageCompressedBytes] = useState<
    number | null
  >(null);
  const [productImageCompressing, setProductImageCompressing] = useState(false);
  const compressJobRef = useRef(0);

  const [categoryDeleteId, setCategoryDeleteId] = useState<number | null>(null);
  const [categoryDeletingId, setCategoryDeletingId] = useState<number | null>(null);

  const [productDeleteId, setProductDeleteId] = useState<number | null>(null);
  const [productDeletingId, setProductDeletingId] = useState<number | null>(null);

  const productImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (productImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(productImagePreviewUrl);
      }
    };
  }, [productImagePreviewUrl]);

  const uploadProductImage = async (file: File): Promise<string> => {
    const extRaw = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const ext = /^[a-z0-9]+$/.test(extRaw) ? extRaw : "bin";

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(16).slice(2);

    const path = `${Date.now()}-${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Не удалось получить публичную ссылку на изображение");
    return data.publicUrl;
  };

  const openCreateCategory = () => {
    setCategoryEditing(null);
    setCategoryName("");
    setCategorySlug("");
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: CategoryRow) => {
    setCategoryEditing(cat);
    setCategoryName(cat.name);
    setCategorySlug(cat.slug);
    setCategoryDialogOpen(true);
  };

  const submitCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      toast({ title: "Введите название категории" });
      return;
    }

    const requested = categorySlug.trim();
    const slug = requested ? slugify(requested) : slugify(name);
    if (!slug.trim()) {
      toast({ title: "Slug не может быть пустым" });
      return;
    }

    setCategorySaving(true);
    try {
      if (categoryEditing) {
        const { error } = await supabase
          .from("categories")
          .update({ name, slug })
          .eq("id", categoryEditing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name, slug });
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminCategories"] }),
        queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["productsByCategory"] }),
      ]);

      setCategoryDialogOpen(false);
      toast({
        title: categoryEditing ? "Категория обновлена" : "Категория создана",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: getDbErrorMessage(error, "Не удалось сохранить"),
      });
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (id: number) => {
    setCategoryDeletingId(id);
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminCategories"] }),
        queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["productsByCategory"] }),
      ]);

      toast({ title: "Категория удалена" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: getDbErrorMessage(error, "Не удалось удалить"),
      });
    } finally {
      setCategoryDeletingId(null);
      setCategoryDeleteId(null);
    }
  };

  const openCreateProduct = () => {
    setProductEditing(null);
    setProductName("");
    setProductCategoryId(NO_CATEGORY_VALUE);
    setProductInStock(true);
    setProductPrice("");
    setProductImageUrl("");
    setProductImageFile(null);
    setProductImagePreviewUrl("");
    setProductImageOriginalBytes(null);
    setProductImageCompressedBytes(null);
    setProductImageCompressing(false);
    setProductDialogOpen(true);
  };

  const openEditProduct = (p: ProductRow) => {
    setProductEditing(p);
    setProductName(p.name);
    setProductCategoryId(
      p.category_id === null ? NO_CATEGORY_VALUE : String(p.category_id),
    );
    setProductInStock(Boolean(p.in_stock));
    setProductPrice(p.price === null ? "" : String(p.price));
    setProductImageUrl(p.image ?? "");
    setProductImageFile(null);
    setProductImagePreviewUrl("");
    setProductImageOriginalBytes(null);
    setProductImageCompressedBytes(null);
    setProductImageCompressing(false);
    setProductDialogOpen(true);
  };

  const submitProduct = async () => {
    const name = productName.trim();
    if (!name) {
      toast({ title: "Введите название товара" });
      return;
    }

    const price = productPrice.trim().length
      ? Number(productPrice.replace(",", "."))
      : null;

    if (price !== null && Number.isNaN(price)) {
      toast({ title: "Цена должна быть числом" });
      return;
    }

    const category_id =
      !productCategoryId || productCategoryId === NO_CATEGORY_VALUE
        ? null
        : Number(productCategoryId);

    if (category_id !== null && Number.isNaN(category_id)) {
      toast({ title: "Категория выбрана некорректно" });
      return;
    }

    setProductSaving(true);
    try {
      const imageUrl = productImageFile
        ? await uploadProductImage(productImageFile)
        : productImageUrl.trim().length
          ? productImageUrl.trim()
          : null;

      const payload = {
        name,
        category_id,
        in_stock: productInStock,
        price,
        image: imageUrl,
      };

      if (productEditing) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", productEditing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["productsByCategory"] }),
      ]);

      setProductDialogOpen(false);
      toast({ title: productEditing ? "Товар обновлён" : "Товар создан" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: getDbErrorMessage(error, "Не удалось сохранить"),
      });
    } finally {
      setProductSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    setProductDeletingId(id);
    try {
      const imageFromCache = (productsQuery.data?.items ?? []).find((p) => p.id === id)?.image ?? null;
      const imageUrl = imageFromCache
        ? imageFromCache
        : (
            await supabase
              .from("products")
              .select("image")
              .eq("id", id)
              .maybeSingle()
          ).data?.image ?? null;

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      const storagePath = imageUrl ? getStoragePathFromPublicUrl(imageUrl) : null;
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([storagePath]);

        if (storageError) {
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: getDbErrorMessage(
              storageError,
              "Товар удалён, но не удалось удалить фото из хранилища",
            ),
          });
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["productsByCategory"] }),
      ]);

      toast({ title: "Товар удалён" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: getDbErrorMessage(error, "Не удалось удалить"),
      });
    } finally {
      setProductDeletingId(null);
      setProductDeleteId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [cats, prods] = await Promise.all([
        categoriesQuery.refetch(),
        productsQuery.refetch(),
      ]);

      const errors: unknown[] = [];
      if (cats.error) errors.push(cats.error);
      if (prods.error) errors.push(prods.error);

      if (errors.length) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: getDbErrorMessage(errors[0], "Не удалось обновить данные"),
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: getDbErrorMessage(error, "Не удалось обновить данные"),
      });
    } finally {
      setRefreshing(false);
    }
  };

  const isInitialLoading = categoriesQuery.isLoading || productsQuery.isLoading;
  const isBusy = isInitialLoading || refreshing;

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Navigation />

      <section className="pt-28 md:pt-32 pb-16 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Панель управления
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground leading-tight">
            Админка
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-loose">
            Управляйте категориями и товарами. Изменения сразу отражаются на
            главной странице и в каталоге.
          </p>
        </motion.div>

        <div className="mt-10">
          <Tabs defaultValue="categories" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="categories" className="flex-1 sm:flex-none">
                  Категории
                </TabsTrigger>
                <TabsTrigger value="products" className="flex-1 sm:flex-none">
                  Товары
                </TabsTrigger>
              </TabsList>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Обновить"
                  )}
                </Button>
              </div>
            </div>

            <TabsContent value="categories">
              <div className="mt-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Категории</h2>
                  <p className="text-sm text-muted-foreground">
                    Название и slug используются для фильтрации на витрине.
                  </p>
                </div>
                <Button onClick={openCreateCategory} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6 border border-border rounded-lg bg-card/30"
              >
                {categoriesQuery.isLoading ? (
                  <div className="p-10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : categoriesQuery.isError ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    Не удалось загрузить категории.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Название</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead className="w-[160px]">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoriesTotal === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-sm text-muted-foreground py-10 text-center"
                            >
                              Категорий пока нет.
                            </TableCell>
                          </TableRow>
                        ) : null}

                        {categoriesPageItems.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {cat.slug}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => openEditCategory(cat)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Редактировать
                                </Button>

                                <AlertDialog
                                  open={categoryDeleteId === cat.id}
                                  onOpenChange={(open) => {
                                    if (!open && categoryDeletingId === cat.id) return;
                                    setCategoryDeleteId(open ? cat.id : null);
                                  }}
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Удалить
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Удалить категорию?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Категория «{cat.name}» будет удалена.
                                        Товары могут остаться без категории.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel
                                        disabled={categoryDeletingId === cat.id}
                                      >
                                        Отмена
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => {
                                          e.preventDefault();
                                          deleteCategory(cat.id);
                                        }}
                                        disabled={categoryDeletingId === cat.id}
                                        className="gap-2"
                                      >
                                        {categoryDeletingId === cat.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                        Удалить
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {categoriesTotalPages > 1 ? (
                      <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Страница {categoriesPage} из {categoriesTotalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCategoriesPage((p) => Math.max(1, p - 1))}
                            disabled={categoriesPage <= 1}
                          >
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCategoriesPage((p) => Math.min(categoriesTotalPages, p + 1))
                            }
                            disabled={categoriesPage >= categoriesTotalPages}
                          >
                            Вперед
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="products">
              <div className="mt-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Товары</h2>
                  <p className="text-sm text-muted-foreground">
                    Управляйте карточками: категория, наличие, цена и фото.
                  </p>
                </div>
                <Button onClick={openCreateProduct} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6 border border-border rounded-lg bg-card/30"
              >
                {productsQuery.isLoading ? (
                  <div className="p-10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : productsQuery.isError ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    Не удалось загрузить товары.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Товар</TableHead>
                          <TableHead>Категория</TableHead>
                          <TableHead>Наличие</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead className="w-[200px]">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(productsQuery.data?.items ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-sm text-muted-foreground py-10 text-center"
                            >
                              Товаров пока нет.
                            </TableCell>
                          </TableRow>
                        ) : null}

                        {(productsQuery.data?.items ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-secondary/20 shrink-0">
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate">{p.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    ID: {p.id}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.category_id && categoriesById.get(p.category_id)
                                ? categoriesById.get(p.category_id)?.name
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  p.in_stock
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                {p.in_stock ? "В наличии" : "Нет"}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatMoney(p.price)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => openEditProduct(p)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Редактировать
                                </Button>

                                <AlertDialog
                                  open={productDeleteId === p.id}
                                  onOpenChange={(open) => {
                                    if (!open && productDeletingId === p.id) return;
                                    setProductDeleteId(open ? p.id : null);
                                  }}
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Удалить
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Удалить товар?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Товар «{p.name}» будет удалён.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel
                                        disabled={productDeletingId === p.id}
                                      >
                                        Отмена
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => {
                                          e.preventDefault();
                                          deleteProduct(p.id);
                                        }}
                                        disabled={productDeletingId === p.id}
                                        className="gap-2"
                                      >
                                        {productDeletingId === p.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                        Удалить
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {productsTotalPages && productsTotalPages > 1 ? (
                      <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Страница {productsPage} из {productsTotalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                            disabled={productsQuery.isFetching || productsPage <= 1}
                          >
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductsPage((p) => p + 1)}
                            disabled={productsQuery.isFetching || productsPage >= productsTotalPages}
                          >
                            Вперед
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Footer />

      {/* Category dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {categoryEditing ? "Редактировать категорию" : "Новая категория"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Название
              </label>
              <Input
                value={categoryName}
                onChange={(e) => {
                  const next = e.target.value;
                  setCategoryName(next);
                  if (!categoryEditing && !categorySlug) {
                    setCategorySlug(slugify(next));
                  }
                }}
                placeholder="Например: Ceramics"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Slug
              </label>
              <Input
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                placeholder="Например: ceramics"
              />
              <p className="text-xs text-muted-foreground">
                Используется в URL/фильтрах. Можно оставить автозначение.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
              disabled={categorySaving}
            >
              Отмена
            </Button>
            <Button onClick={submitCategory} disabled={categorySaving} className="gap-2">
              {categorySaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {productEditing ? "Редактировать товар" : "Новый товар"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Название товара
              </label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Например: Artisan Clay Plate"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Категория
              </label>
              <Select
                value={productCategoryId}
                onValueChange={(v) => setProductCategoryId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Без категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY_VALUE}>Без категории</SelectItem>
                  {(categoriesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Наличие
              </label>
              <div className="flex items-center justify-between rounded-md border border-input px-3 h-9">
                <span className="text-sm text-muted-foreground">
                  {productInStock ? "В наличии" : "Нет"}
                </span>
                <Switch checked={productInStock} onCheckedChange={setProductInStock} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Стоимость
              </label>
              <Input
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                inputMode="decimal"
                placeholder="Например: 99.99"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Фото (файл)
              </label>
              {productEditing && productImageUrl && !productImageFile ? (
                <p className="text-xs text-muted-foreground">
                  Фото уже загружено.
                </p>
              ) : null}

              <input
                ref={productImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={productSaving}
                onChange={async (e) => {
                  const selected = e.target.files?.[0] ?? null;

                  if (productImagePreviewUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(productImagePreviewUrl);
                  }

                  setProductImageFile(null);
                  setProductImagePreviewUrl("");
                  setProductImageOriginalBytes(selected ? selected.size : null);
                  setProductImageCompressedBytes(null);

                  if (!selected) {
                    setProductImageCompressing(false);
                    return;
                  }

                  const jobId = ++compressJobRef.current;
                  setProductImageCompressing(true);

                  try {
                    const compressed = await compressProductImage(selected);
                    if (compressJobRef.current !== jobId) return;

                    setProductImageFile(compressed);
                    setProductImageCompressedBytes(compressed.size);
                    setProductImagePreviewUrl(URL.createObjectURL(compressed));
                  } catch (error: unknown) {
                    if (compressJobRef.current !== jobId) return;
                    toast({
                      variant: "destructive",
                      title: "Ошибка",
                      description: getDbErrorMessage(error, "Не удалось сжать изображение"),
                    });

                    // Fallback: allow upload of original file.
                    setProductImageFile(selected);
                    setProductImageCompressedBytes(selected.size);
                    setProductImagePreviewUrl(URL.createObjectURL(selected));
                  } finally {
                    if (compressJobRef.current !== jobId) return;
                    setProductImageCompressing(false);
                  }
                }}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={productSaving}
                onClick={() => productImageInputRef.current?.click()}
                className="h-auto px-0 py-0 underline underline-offset-4"
              >
                {productImageCompressing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Сжимаю…
                  </>
                ) : (
                  "Загрузить фото"
                )}
              </Button>

              {productImageOriginalBytes !== null ? (
                <p className="text-xs text-muted-foreground">
                  Размер: {formatBytes(productImageOriginalBytes)}
                  {productImageCompressedBytes !== null
                    ? ` → ${formatBytes(productImageCompressedBytes)}`
                    : ""}
                </p>
              ) : null}
              {productImagePreviewUrl || productImageUrl ? (
                <div className="mt-2 rounded-lg overflow-hidden bg-secondary/20 border border-border">
                  <img
                    src={productImagePreviewUrl || productImageUrl}
                    alt="preview"
                    className="w-full h-44 object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProductDialogOpen(false)}
              disabled={productSaving}
            >
              Отмена
            </Button>
            <Button onClick={submitProduct} disabled={productSaving} className="gap-2">
              {productSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
