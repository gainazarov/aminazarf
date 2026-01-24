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
// Chart removed from Admin stats UI

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
const EMPTY_SELECT_VALUE = "__empty__";
const PRODUCT_IMAGES_BUCKET = "product-images";
const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  processing: "В обработке",
  done: "Выполнена",
};

function getStatusLabel(status: string | null | undefined) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

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

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const pageSize = 20;
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Tabs and statistics state
  const [activeTab, setActiveTab] = useState<string>("categories");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<
    | null
    | {
        total: number;
        perCategory: Array<{
          id: number;
          name: string;
          total: number;
          inStock: number;
          outOfStock: number;
        }>;
      }
    >(null);

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
    queryKey: ["adminProducts", productsPage, pageSize, filterCategory],
    queryFn: async () => {
      const from = (productsPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("products")
        .select("id,name,category_id,in_stock,price,image", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterCategory && filterCategory !== "all") {
        const cid = Number(filterCategory);
        if (Number.isFinite(cid)) query = query.eq("category_id", cid);
      }

      const { data, error, count } = await query;
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

  // Requests (Заявки)
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsSort, setRequestsSort] = useState<"desc" | "asc">("desc");

  const requestsQuery = useQuery({
    queryKey: ["adminRequests", requestsPage, pageSize, requestsSort],
    queryFn: async () => {
      const from = (requestsPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("requests")
        .select("id,client_name,client_phone,client_message,product_id,status,created_at", { count: "exact" })
        .order("created_at", { ascending: requestsSort === "asc" })
        .range(from, to);
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: unknown;
        client_name: unknown;
        client_phone: unknown;
        client_message: unknown;
        product_id: unknown;
        status: unknown;
        created_at: unknown;
      }>;

      // map basic fields
      const items = rows.map((r) => ({
        id: toFiniteNumber(r.id),
        client_name: typeof r.client_name === "string" ? r.client_name : null,
        client_phone: typeof r.client_phone === "string" ? r.client_phone : null,
        client_message: typeof r.client_message === "string" ? r.client_message : null,
        product_id: toNullableFiniteNumber(r.product_id),
        status: typeof r.status === "string" ? r.status : null,
        created_at: typeof r.created_at === "string" ? r.created_at : null,
      }));

      // fetch linked products for displayed page
      const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean) as number[]));
      let productsMap = new Map<number, { id: number; name: string; category_id: number | null; price: number | null; in_stock: boolean; image: string | null }>();
      if (productIds.length > 0) {
        const { data: pdata } = await supabase
          .from("products")
          .select("id,name,category_id,price,in_stock,image")
          .in("id", productIds);
        (pdata ?? []).forEach((p: any) =>
          productsMap.set(toFiniteNumber(p.id), {
            id: toFiniteNumber(p.id),
            name: p.name,
            category_id: toNullableFiniteNumber(p.category_id),
            price: toNullableFiniteNumber(p.price),
            in_stock: Boolean(p.in_stock),
            image: p.image ?? null,
          }),
        );
      }

      return { items, total: count ?? 0, page: requestsPage, pageSize, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)), productsMap };
    },
  });

  const requestsTotalPages = requestsQuery.data?.totalPages;

  useEffect(() => {
    if (categoriesPage > categoriesTotalPages) setCategoriesPage(categoriesTotalPages);
  }, [categoriesPage, categoriesTotalPages]);

  useEffect(() => {
    if (!productsTotalPages) return;
    if (productsPage > productsTotalPages) setProductsPage(productsTotalPages);
  }, [productsPage, productsTotalPages]);

  // Request dialog state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestEditing, setRequestEditing] = useState<null | {
    id: number;
    client_name: string | null;
    client_phone: string | null;
    client_message: string | null;
    product_id: number | null;
    status: string | null;
    created_at: string | null;
  }>(null);
  const [requestStatusUpdating, setRequestStatusUpdating] = useState<Record<number, boolean>>({});

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

  // Lazy-load statistics when the Stats tab is opened
  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      if (statsData) return; // already loaded
      setStatsLoading(true);
      try {
        const { count: totalCount } = await supabase
          .from("products")
          .select("id", { head: true, count: "exact" });

        const cats = (categoriesQuery.data ?? []) as CategoryRow[];

        const perCategory = await Promise.all(
          cats.map(async (c) => {
            try {
              const { count: catTotal } = await supabase
                .from("products")
                .select("id", { head: true, count: "exact" })
                .eq("category_id", c.id);

              const { count: catInStock } = await supabase
                .from("products")
                .select("id", { head: true, count: "exact" })
                .eq("category_id", c.id)
                .eq("in_stock", true);

              const total = catTotal ?? 0;
              const inStock = catInStock ?? 0;
              return {
                id: c.id,
                name: c.name,
                total,
                inStock,
                outOfStock: Math.max(0, total - inStock),
              };
            } catch {
              return { id: c.id, name: c.name, total: 0, inStock: 0, outOfStock: 0 };
            }
          }),
        );

        if (!mounted) return;
        setStatsData({ total: totalCount ?? 0, perCategory });
      } catch (err) {
        console.error("Failed to load stats", err);
        if (!mounted) return;
        setStatsData({ total: 0, perCategory: [] });
      } finally {
        if (!mounted) return;
        setStatsLoading(false);
      }
    }

    if (activeTab === "stats") loadStats();

    // also load requests stats automatically when opening stats tab
    if (activeTab === "stats") {
      loadRequestsStatsAll().catch((err) => console.error("requests all-time stats load failed", err));
      loadRequestsStatsMonth(selectedMonth).catch((err) => console.error("requests month stats load failed", err));
    }

    return () => {
      mounted = false;
    };
  }, [activeTab, categoriesQuery.data, statsData]);

  // Requests stats loaders: split into all-time and month-specific so changing month
  // doesn't re-fetch the all-time aggregates.
  const loadRequestsStatsAll = async () => {
    if (requestsStatsAllData) return; // already loaded
    setRequestsStatsAllLoading(true);
    try {
      const statuses = ["new", "processing", "done"];
      const { count: totalAll } = await supabase.from("requests").select("id", { head: true, count: "exact" });
      const byStatusAll: Record<string, number> = {};
      await Promise.all(
        statuses.map(async (s) => {
          const { count: c } = await supabase.from("requests").select("id", { head: true, count: "exact" }).eq("status", s);
          byStatusAll[s] = c ?? 0;
        }),
      );
      setRequestsStatsAllData({ totalAll: totalAll ?? 0, byStatusAll });
    } catch (err) {
      console.error("Failed to load requests all-time stats", err);
      setRequestsStatsAllData(null);
    } finally {
      setRequestsStatsAllLoading(false);
    }
  };

  const loadRequestsStatsMonth = async (month?: string) => {
    setRequestsStatsMonthLoading(true);
    try {
      const statuses = ["new", "processing", "done"];
      let daily: Array<{ date: string; count: number }> = [];
      let totalMonth = 0;
      const byStatusMonth: Record<string, number> = {};
      let prevMonthTotal: number | undefined = undefined;
      let monthLabel = "—";

      if (month) {
        const [y, m] = month.split("-").map((s) => Number(s));
        const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

        const { data: monthRows, error: monthError } = await supabase
          .from("requests")
          .select("created_at")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: true });
        if (monthError) throw monthError;

        const counts: Record<string, number> = {};
        (monthRows ?? []).forEach((r: any) => {
          const d = new Date(r.created_at);
          const key = d.toISOString().slice(0, 10);
          counts[key] = (counts[key] || 0) + 1;
        });

        const daysInMonth = new Date(y, m, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dt = new Date(Date.UTC(y, m - 1, day));
          const key = dt.toISOString().slice(0, 10);
          daily.push({ date: key, count: counts[key] || 0 });
        }

        totalMonth = (monthRows ?? []).length;

        await Promise.all(
          statuses.map(async (s) => {
            const { count: c } = await supabase
              .from("requests")
              .select("id", { head: true, count: "exact" })
              .eq("status", s)
              .gte("created_at", start.toISOString())
              .lt("created_at", end.toISOString());
            byStatusMonth[s] = c ?? 0;
          }),
        );

        const prevStart = new Date(Date.UTC(y, m - 2, 1));
        const prevEnd = start;
        const { count: prevCount } = await supabase
          .from("requests")
          .select("id", { head: true, count: "exact" })
          .gte("created_at", prevStart.toISOString())
          .lt("created_at", prevEnd.toISOString());
        prevMonthTotal = prevCount ?? 0;

        monthLabel = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1).toLocaleString("ru-RU", { month: "long", year: "numeric" });
      }

      const percentChange = typeof prevMonthTotal === "number" && prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : null;

      setRequestsStatsMonthData({ totalMonth, byStatusMonth, monthLabel, daily: daily.length ? daily : undefined, prevMonthTotal, percentChange });
    } catch (err) {
      console.error("Failed to load requests month stats", err);
      setRequestsStatsMonthData(null);
    } finally {
      setRequestsStatsMonthLoading(false);
    }
  };

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
  // Requests statistics state
  const [requestsStatsAllLoading, setRequestsStatsAllLoading] = useState(false);
  const [requestsStatsMonthLoading, setRequestsStatsMonthLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [requestsStatsAllData, setRequestsStatsAllData] = useState<null | {
    totalAll: number;
    byStatusAll: Record<string, number>;
  }>(null);

  const [requestsStatsMonthData, setRequestsStatsMonthData] = useState<null | {
    totalMonth: number;
    byStatusMonth: Record<string, number>;
    monthLabel: string;
    daily?: Array<{ date: string; count: number }>;
    prevMonthTotal?: number;
    percentChange?: number | null;
  }>(null);
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
      const [cats, prods, reqs] = await Promise.all([
        categoriesQuery.refetch(),
        productsQuery.refetch(),
        requestsQuery.refetch(),
      ]);

      const errors: unknown[] = [];
      if (cats.error) errors.push(cats.error);
      if (prods.error) errors.push(prods.error);
      if (reqs.error) errors.push(reqs.error);

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

  const isInitialLoading = categoriesQuery.isLoading || productsQuery.isLoading || requestsQuery.isLoading;
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="w-full sm:w-auto overflow-x-auto justify-start sm:justify-center flex-nowrap gap-1">
                <TabsTrigger value="categories" className="flex-1 sm:flex-none">
                  Категории
                </TabsTrigger>
                <TabsTrigger value="products" className="flex-1 sm:flex-none">
                  Товары
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-1 sm:flex-none">
                  Заявки
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex-1 sm:flex-none">
                  Статистика
                </TabsTrigger>
              </TabsList>

              <div className="flex justify-end gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isBusy}
                  className="w-full sm:w-auto"
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
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Категории</h2>
                  <p className="text-sm text-muted-foreground">
                    Название и slug используются для фильтрации на витрине.
                  </p>
                </div>
                <Button onClick={openCreateCategory} className="gap-2 w-full sm:w-auto">
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
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[560px]">
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
                    </div>

                    {categoriesTotalPages > 1 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Страница {categoriesPage} из {categoriesTotalPages}
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCategoriesPage((p) => Math.max(1, p - 1))}
                            disabled={categoriesPage <= 1}
                            className="w-full sm:w-auto"
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
                            className="w-full sm:w-auto"
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
              <div className="mt-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Товары</h2>
                  <p className="text-sm text-muted-foreground">
                    Управляйте карточками: категория, наличие, цена и фото.
                  </p>
                </div>
                <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                    <Select
                      value={filterCategory ?? "all"}
                      onValueChange={(v) => {
                        setFilterCategory(v === "all" ? null : v);
                        setProductsPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:min-w-[160px]">
                        <SelectValue placeholder="Все категории" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все категории</SelectItem>
                        {(categoriesQuery.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterCategory(null);
                        setProductsPage(1);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Сбросить
                    </Button>
                  </div>

                  <Button onClick={openCreateProduct} className="gap-2 w-full sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Добавить
                  </Button>
                </div>
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
                    {/* --- Stats: will be rendered below for the "stats" tab --- */}
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[860px]">
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
                    </div>

                    {productsTotalPages && productsTotalPages > 1 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Страница {productsPage} из {productsTotalPages}
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                            disabled={productsQuery.isFetching || productsPage <= 1}
                            className="w-full sm:w-auto"
                          >
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductsPage((p) => p + 1)}
                            disabled={productsQuery.isFetching || productsPage >= productsTotalPages}
                            className="w-full sm:w-auto"
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

            <TabsContent value="requests">
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Заявки</h2>
                  <p className="text-sm text-muted-foreground">Список входящих заявок. Новые — сверху.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRequestsSort((s) => (s === "desc" ? "asc" : "desc"));
                      setRequestsPage(1);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Сортировать: {requestsSort === "desc" ? "Новые сверху" : "Старые сверху"}
                  </Button>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6 border border-border rounded-lg bg-card/30"
              >
                {requestsQuery.isLoading ? (
                  <div className="p-10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : requestsQuery.isError ? (
                  <div className="p-6 text-sm text-muted-foreground">Не удалось загрузить заявки.</div>
                ) : (
                  <>
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Телефон</TableHead>
                          <TableHead>Сообщение</TableHead>
                          <TableHead>Товар / Категория</TableHead>
                          <TableHead>Дата</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(requestsQuery.data?.items ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-sm text-muted-foreground py-10 text-center">Заявок пока нет.</TableCell>
                          </TableRow>
                        ) : null}

                        {(requestsQuery.data?.items ?? []).map((r) => {
                          const prod = r.product_id ? requestsQuery.data?.productsMap?.get(r.product_id) : undefined;
                          const catName = prod?.category_id ? categoriesById.get(prod.category_id)?.name : "—";
                          const prodName = prod?.name ?? "—";
                          const isUpdating = !!requestStatusUpdating[r.id];
                          return (
                            <TableRow key={r.id} className="cursor-pointer" onClick={() => {
                              setRequestDialogOpen(true);
                              setRequestEditing(r);
                            }}>
                              <TableCell className="font-medium">{r.client_name ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{r.client_phone ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{(r.client_message ?? "").length > 60 ? `${(r.client_message ?? "").slice(0,60)}…` : r.client_message}</TableCell>
                              <TableCell className="text-muted-foreground">{prodName} <div className="text-xs text-muted-foreground">{catName}</div></TableCell>
                              <TableCell className="text-muted-foreground text-sm">{formatDateTime(r.created_at)}</TableCell>
                              <TableCell>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Select value={String(r.status ?? EMPTY_SELECT_VALUE)} onValueChange={async (val) => {
                                    const newStatus = val === EMPTY_SELECT_VALUE ? null : (val || null);
                                    setRequestStatusUpdating((prev) => ({ ...prev, [r.id]: true }));
                                    try {
                                      const { error } = await supabase.from("requests").update({ status: newStatus }).eq("id", r.id);
                                      if (error) throw error;
                                      queryClient.invalidateQueries({ queryKey: ["adminRequests"] });
                                      toast({ title: "Статус обновлён" });
                                    } catch (error: unknown) {
                                      toast({
                                        variant: "destructive",
                                        title: "Ошибка",
                                        description: getDbErrorMessage(error, "Не удалось обновить статус"),
                                      });
                                    } finally {
                                      setRequestStatusUpdating((prev) => ({ ...prev, [r.id]: false }));
                                    }
                                  }}>
                                    <SelectTrigger disabled={isUpdating} className="min-w-[130px]">
                                      <div className="flex items-center justify-between w-full gap-2">
                                        <SelectValue placeholder={"—"} />
                                        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new">{getStatusLabel("new")}</SelectItem>
                                      <SelectItem value="processing">{getStatusLabel("processing")}</SelectItem>
                                      <SelectItem value="done">{getStatusLabel("done")}</SelectItem>
                                      <SelectItem value={EMPTY_SELECT_VALUE}>—</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                        </Table>
                      </div>

                    {requestsTotalPages && requestsTotalPages > 1 ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-border">
                        <span className="text-xs text-muted-foreground">Страница {requestsPage} из {requestsTotalPages}</span>
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                            disabled={requestsQuery.isFetching || requestsPage <= 1}
                              className="w-full sm:w-auto"
                          >
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRequestsPage((p) => Math.min(requestsTotalPages ?? p + 1, p + 1))}
                            disabled={requestsQuery.isFetching || requestsPage >= (requestsTotalPages ?? Infinity)}
                              className="w-full sm:w-auto"
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

            <TabsContent value="stats">
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl">Статистика</h2>
                    <p className="text-sm text-muted-foreground">Общая статистика по товарам и по категориям.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // reset computed stats so user can re-run
                        setStatsData(null);
                        setActiveTab("stats");
                      }}
                      className="w-full sm:w-auto"
                    >
                      Пересчитать
                    </Button>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-6 border border-border rounded-lg bg-card/30 p-6"
                >
                  {statsLoading ? (
                    <div className="p-10 flex flex-col items-center gap-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">Выполняется подсчёт...</div>
                    </div>
                  ) : statsData ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Общее количество товаров</div>
                        <div className="font-medium text-foreground">{statsData.total}</div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold">Товары по категориям</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {statsData.perCategory.map((c) => (
                            <div key={c.id} className="p-4 border rounded-md bg-background">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{c.name}</div>
                                <div className="text-sm text-muted-foreground">Всего: {c.total}</div>
                              </div>
                              <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                                <div>В наличии: <span className="text-foreground">{c.inStock}</span></div>
                                <div>Нет в наличии: <span className="text-foreground">{c.outOfStock}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">Нажмите «Пересчитать», чтобы получить статистику.</div>
                  )}
                </motion.div>
                {/* Requests statistics */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-6 border border-border rounded-lg bg-card/30 p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Заявки</h3>
                      <p className="text-sm text-muted-foreground">Статистика по входящим заявкам.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                      <input
                        type="month"
                        className="rounded-md border border-input px-2 py-1 text-sm w-full sm:w-auto"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRequestsStatsMonth(selectedMonth)}
                        disabled={requestsStatsMonthLoading}
                        className="w-full sm:w-auto"
                      >
                        {requestsStatsMonthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Показать"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const d = new Date();
                          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                          setSelectedMonth(val);
                          loadRequestsStatsMonth(val);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Сбросить
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: all-time */}
                    <div className="space-y-4">
                      <div className="p-4 rounded-md border border-border bg-background">
                        <div className="text-xs text-muted-foreground">Всего заявок (за всё время)</div>
                        {requestsStatsAllLoading && !requestsStatsAllData ? (
                          <div className="mt-2 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="text-2xl font-semibold mt-2">{requestsStatsAllData?.totalAll ?? 0}</div>
                        )}
                      </div>

                      <div className="p-4 rounded-md border border-border bg-background">
                        <div className="text-xs text-muted-foreground">Статистика по статусам (за всё время)</div>
                        <div className="mt-2 space-y-2">
                          {requestsStatsAllData ? (
                            ["new", "processing", "done"].map((status) => (
                              <div key={status} className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">{getStatusLabel(status)}</div>
                                <div className="font-medium">{requestsStatsAllData.byStatusAll[status] ?? 0}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">Загрузка...</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: month-specific */}
                    <div className="space-y-4">
                      <div className="p-4 rounded-md border border-border bg-background">
                        <div className="text-xs text-muted-foreground">Заявок в {requestsStatsMonthData?.monthLabel ?? "—"}</div>
                        <div className="flex items-center gap-3 mt-2">
                          {requestsStatsMonthLoading && !requestsStatsMonthData ? (
                            <div className="mt-1">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="text-2xl font-semibold">{requestsStatsMonthData?.totalMonth ?? 0}</div>
                          )}
                          {requestsStatsMonthData && requestsStatsMonthData.percentChange !== undefined ? (
                            requestsStatsMonthData.percentChange === null ? (
                              <div className="text-xs text-muted-foreground">нет данных прошлого месяца</div>
                            ) : (
                              <div className={`text-sm font-medium ${requestsStatsMonthData.percentChange! > 0 ? 'text-green-600' : requestsStatsMonthData.percentChange! < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {requestsStatsMonthData.percentChange! > 0 ? '+' : ''}{requestsStatsMonthData.percentChange!.toFixed(1)}%
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>

                      <div className="p-4 rounded-md border border-border bg-background">
                        <div className="text-xs text-muted-foreground">Статистика по статусам (в выбранном месяце)</div>
                        <div className="mt-2 space-y-2">
                          {!requestsStatsMonthData ? (
                            <div className="text-sm text-muted-foreground">Нажмите «Показать», чтобы загрузить данные за месяц.</div>
                          ) : Object.keys(requestsStatsMonthData.byStatusMonth).length === 0 ? (
                            <div className="text-sm text-muted-foreground">Нет данных за выбранный месяц.</div>
                          ) : (
                            ["new", "processing", "done"].map((status) => (
                              <div key={status} className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">{getStatusLabel(status)}</div>
                                <div className="font-medium">{requestsStatsMonthData.byStatusMonth[status] ?? 0}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </TabsContent>

            {/* Request details modal (opened when clicking a request row) */}
            <Dialog open={requestDialogOpen} onOpenChange={(v) => { if(!v) { setRequestDialogOpen(false); setRequestEditing(null); } else setRequestDialogOpen(v); }}>
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Детали заявки</DialogTitle>
                </DialogHeader>
                {requestEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                      <div className="w-full">
                        <div className="aspect-[4/5] w-full rounded-xl overflow-hidden bg-secondary/30">
                          {requestEditing.product_id ? (
                            (() => {
                              const p = requestsQuery.data?.productsMap?.get(requestEditing.product_id as number);
                              return p?.image ? (
                                <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Фото отсутствует</div>
                              );
                            })()
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Товар не выбран</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-widest text-muted-foreground">Товар</div>
                          {requestEditing.product_id ? (
                            (() => {
                              const p = requestsQuery.data?.productsMap?.get(requestEditing.product_id as number);
                              const cat = p?.category_id ? categoriesById.get(p.category_id)?.name : "—";
                              return p ? (
                                <div>
                                  <div className="text-lg font-semibold">{p.name}</div>
                                  <div className="text-sm text-muted-foreground">Категория: {cat}</div>
                                  <div className="text-sm text-muted-foreground">Цена: {formatMoney(p.price)}</div>
                                  <div className="text-sm text-muted-foreground">Наличие: {p.in_stock ? "В наличии" : "Нет"}</div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Товар удалён</div>
                              );
                            })()
                          ) : (
                            <div className="text-sm text-muted-foreground">—</div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs uppercase tracking-widest text-muted-foreground">Клиент</div>
                            <div className="mt-1 font-medium">{requestEditing.client_name ?? "—"}</div>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs uppercase tracking-widest text-muted-foreground">Телефон</div>
                            <div className="mt-1 font-medium">{requestEditing.client_phone ?? "—"}</div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border p-3">
                          <div className="text-xs uppercase tracking-widest text-muted-foreground">Дата</div>
                          <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(requestEditing.created_at)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-4 bg-background/60">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Сообщение</div>
                      <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                        {requestEditing.client_message ?? "—"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-muted-foreground">Статус</label>
                      <Select value={String(requestEditing.status ?? EMPTY_SELECT_VALUE)} onValueChange={async (val) => {
                        const newStatus = val === EMPTY_SELECT_VALUE ? null : (val || null);
                        setRequestStatusUpdating((prev) => ({ ...prev, [requestEditing.id]: true }));
                        try {
                          const { error } = await supabase.from("requests").update({ status: newStatus }).eq("id", requestEditing.id);
                          if (error) throw error;
                          setRequestEditing((prev) => prev ? { ...prev, status: newStatus } : prev);
                          queryClient.invalidateQueries({ queryKey: ["adminRequests"] });
                          toast({ title: "Статус обновлён" });
                        } catch (error: unknown) {
                          toast({
                            variant: "destructive",
                            title: "Ошибка",
                            description: getDbErrorMessage(error, "Не удалось обновить статус"),
                          });
                        } finally {
                          setRequestStatusUpdating((prev) => ({ ...prev, [requestEditing.id]: false }));
                        }
                      }}>
                        <SelectTrigger className="min-w-[160px]" disabled={!!requestStatusUpdating[requestEditing.id]}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <SelectValue placeholder={"—"} />
                            {requestStatusUpdating[requestEditing.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : null}
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{getStatusLabel("new")}</SelectItem>
                          <SelectItem value="processing">{getStatusLabel("processing")}</SelectItem>
                          <SelectItem value="done">{getStatusLabel("done")}</SelectItem>
                          <SelectItem value={EMPTY_SELECT_VALUE}>—</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Выберите заявку для просмотра.</div>
                )}
              </DialogContent>
            </Dialog>
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
