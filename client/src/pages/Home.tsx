import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useProductsPaged, useProductsByCategoryPaged } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

const TeapotLoader = () => (
  <div className="flex flex-col items-center justify-center space-y-3 py-12">
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" />
      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce delay-150" />
      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce delay-300" />
    </div>
    <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-medium">Загрузка</span>
  </div>
);

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const shopLimit = 8;
  const catalogPageSize = 20;
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(true);
  const [newsletterPhone, setNewsletterPhone] = useState("+992");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error("[supabase] getSession error", error);
        else console.log("[supabase] getSession ok", data);
      })
      .catch((error) => console.error("[supabase] getSession threw", error));
  }, []);
  
  // Data Fetching
  const { data: categories } = useCategories();
  const { data: shopAll, isLoading: loadingShopAll } = useProductsPaged(1, shopLimit);
  const { data: shopCat, isLoading: loadingShopCat } = useProductsByCategoryPaged(
    activeCategory,
    1,
    shopLimit,
  );

  const { data: catalogAll, isLoading: loadingCatalogAll } = useProductsPaged(
    catalogPage,
    catalogPageSize,
  );
  const { data: catalogCat, isLoading: loadingCatalogCat } = useProductsByCategoryPaged(
    activeCategory,
    catalogPage,
    catalogPageSize,
  );

  const shopProducts = activeCategory ? shopCat?.items : shopAll?.items;
  const isShopLoading = activeCategory ? loadingShopCat : loadingShopAll;

  // Track which categories actually have products so we can hide empty categories on the main page
  const [categoriesWithProducts, setCategoriesWithProducts] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let mounted = true;
    async function checkCategories() {
      if (!categories || categories.length === 0) return;
      const map: Record<number, boolean> = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id);
            map[cat.id] = (count ?? 0) > 0;
          } catch {
            map[cat.id] = true; // on error, keep category visible to avoid hiding content accidentally
          }
        }),
      );
      if (mounted) setCategoriesWithProducts(map);
    }

    checkCategories();
    return () => {
      mounted = false;
    };
  }, [categories]);

  const catalogResult = activeCategory ? catalogCat : catalogAll;
  const catalogProducts = catalogResult?.items;
  const catalogTotalPages = catalogResult?.totalPages;
  const isCatalogLoading = activeCategory ? loadingCatalogCat : loadingCatalogAll;

  useEffect(() => {
    if (!catalogTotalPages) return;
    if (catalogPage > catalogTotalPages) setCatalogPage(catalogTotalPages);
  }, [catalogPage, catalogTotalPages]);

  const handleCategoryChange = (slug: string | null) => {
    setActiveCategory(slug);
    setCatalogPage(1);
  };

  // Static images for Hero and Featured sections
  const heroImage = "/images/hero.jpg";
  const featuredImage = "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2000&auto=format&fit=crop"; 

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Navigation onOpenCatalog={() => setIsCatalogOpen(true)} />

      {/* HERO SECTION */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <motion.div 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="w-full h-full"
          >
            <div className="absolute inset-0 bg-black/10 z-10" />
            {/* Hero Background - Ceramic Texture */}
            <img 
              src={heroImage} 
              alt="Background" 
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>

        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-white text-xs md:text-sm uppercase tracking-[0.3em] mb-6 font-medium"
          >
            Магазин эксклюзивной посуды
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl text-white mb-10 leading-tight"
          >
            Искусство <br/> <span className="italic font-light">медленной жизни</span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
          >
            <a 
              href="#shop"
              className="inline-block border border-white/40 text-white px-10 py-4 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-500 ease-out"
            >
              Откройте коллекцию
            </a>
          </motion.div>
        </div>
      </section>

      {/* SHOP SECTION */}
      <section id="shop" className="py-24 md:py-32 container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-4 text-foreground">Избранные изделия</h2>
          <div className="w-12 h-px bg-primary/40 mx-auto" />
        </div>

        {/* Category Tabs */}
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 mb-16">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`text-sm uppercase tracking-widest transition-all duration-300 pb-1 border-b-2 ${
                activeCategory === null 
                  ? "text-primary border-primary" 
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Все
            </button>
            {categories?.filter((cat) => categoriesWithProducts[cat.id] !== false).map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={`text-sm uppercase tracking-widest transition-all duration-300 pb-1 border-b-2 ${
                  activeCategory === cat.slug 
                    ? "text-primary border-primary" 
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setIsCatalogOpen(true)}
            className="text-xs uppercase tracking-widest hover-elevate no-default-hover-elevate h-auto py-1 px-2"
          >
            Посмотреть все
          </Button>
        </div>

        {/* Products Grid */}
        {isShopLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce mr-1"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce mr-1 delay-100"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></div>
          </div>
        ) : (
          <>
            {shopProducts && shopProducts.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                Товары к этой категории еще не добавлены.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-12 mb-16">
                {shopProducts?.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    index={idx}
                    name={product.name}
                    price={product.price ?? null}
                    image={product.image}
                    inStock={product.inStock}
                    categoryName={categories?.find(c => c.id === product.categoryId)?.name}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* FULL SCREEN CATALOG MODAL */}
      <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
        <DialogContent className="max-w-none w-screen h-screen m-0 p-0 bg-background border-none rounded-none flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-64 bg-secondary/10 p-6 md:p-8 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-12">
              <h3 className="font-serif text-2xl tracking-tight">Каталог</h3>
              <div className="md:hidden flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                  className="rounded-full"
                >
                  {isCategoryMenuOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            
            <AnimatePresence>
              {(isCategoryMenuOpen || window.innerWidth >= 768) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden md:!h-auto md:!opacity-100"
                >
                  <div className="flex flex-row md:flex-col flex-wrap gap-4 md:gap-8 pb-4">
                    <button
                      onClick={() => handleCategoryChange(null)}
                      className={`text-left text-xs md:text-sm uppercase tracking-[0.2em] transition-all whitespace-nowrap border-b md:border-b-0 pb-1 md:pb-0 ${
                        activeCategory === null ? "text-primary border-primary font-bold" : "text-muted-foreground border-transparent"
                      }`}
                    >
                      Все изделия
                    </button>
                    {categories?.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.slug)}
                        className={`text-left text-xs md:text-sm uppercase tracking-[0.2em] transition-all whitespace-nowrap border-b md:border-b-0 pb-1 md:pb-0 ${
                          activeCategory === cat.slug ? "text-primary border-primary font-bold" : "text-muted-foreground border-transparent"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 p-4 md:p-12 overflow-y-auto relative bg-background">
            {isCatalogLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <TeapotLoader />
              </div>
            ) : (
              <>
                {catalogProducts && catalogProducts.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground">
                    Товары к этой категории еще не добавлены.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-10 md:gap-y-16">
                    {catalogProducts?.map((product, idx) => (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        index={idx}
                        name={product.name}
                        price={product.price ?? null}
                        image={product.image}
                        inStock={product.inStock}
                        categoryName={categories?.find((c) => c.id === product.categoryId)?.name}
                      />
                    ))}
                  </div>
                )}

                {catalogTotalPages && catalogTotalPages > 1 ? (
                  <div className="mt-10 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                      disabled={isCatalogLoading || catalogPage <= 1}
                    >
                      Назад
                    </Button>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Страница {catalogPage} из {catalogTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCatalogPage((p) => p + 1)}
                      disabled={isCatalogLoading || catalogPage >= catalogTotalPages}
                    >
                      Вперед
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* FEATURED STORY SECTION */}
      <section id="about" className="py-24 bg-card/30">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-[4/3] overflow-hidden"
            >
              {/* Featured Lifestyle Image */}
              <img 
                src={featuredImage} 
                alt="Table setting"
                className="w-full h-full object-cover"
              />
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:pl-12"
            >
              <h3 className="font-serif text-3xl md:text-5xl mb-8 leading-tight">
                Красота в <br/>Несовершенстве
              </h3>
              <p className="text-muted-foreground leading-loose mb-8 font-light">
                Наша философия уходит корнями в ваби-саби — поиск красоты в несовершенном, мимолетном и незавершенном. 
                Каждое изделие в нашей Каталог несет на себе отпечаток руки мастера, обладая душой, которую массовое производство просто не может воспроизвести.
              </p>
              <p className="text-muted-foreground leading-loose mb-10 font-light">
                Мы верим, что предметы, которыми мы себя окружаем, должны привносить чувство спокойствия и заземления в наши ежедневные ритуалы.
              </p>
              <a href="#collections" className="text-primary uppercase tracking-widest text-xs border-b border-primary/50 pb-1 hover:text-foreground hover:border-foreground transition-all">
                Наша история
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-32 container mx-auto px-6 text-center">
        <h3 className="font-serif text-3xl mb-4">Оставьте свой контакт</h3>
        <p className="text-muted-foreground mb-8 text-sm">Оставьте номер телефона, и мы сообщим о новых коллекциях и событиях студии.</p>
        <form
          className="max-w-md mx-auto flex flex-col md:flex-row md:items-center border-b border-border pb-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newsletterSubmitting) return;

            const phone = newsletterPhone.trim();
            if (!phone || phone.length < 5) {
              setNewsletterStatus("error");
              toast({
                variant: "destructive",
                title: "Ошибка",
                description: "Введите корректный номер телефона.",
              });
              return;
            }

            setNewsletterSubmitting(true);
            setNewsletterStatus("idle");

            const { error } = await supabase.from("requests").insert({
              client_phone: phone,
            });

            if (error) {
              console.error("[requests] insert error", error);
              setNewsletterStatus("error");
              toast({
                variant: "destructive",
                title: "Ошибка",
                description: "Не удалось отправить заявку. Попробуйте позже.",
              });
            } else {
              setNewsletterStatus("success");
              toast({
                title: "Заявка отправлена",
                description: "Мы свяжемся с вами в ближайшее время.",
              });
            }

            setNewsletterSubmitting(false);
          }}
        >
          <input 
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={newsletterPhone}
            onChange={(e) => {
              const raw = e.target.value;
              const cleaned = raw.replace(/[^0-9+]/g, "");
              setNewsletterPhone(cleaned);
            }}
            placeholder="Введите номер телефона" 
            className="w-full md:flex-1 bg-white/80 text-foreground border border-border/60 rounded-md px-4 py-3 outline-none placeholder:text-muted-foreground/60 text-center shadow-sm lg:bg-transparent lg:border-none lg:rounded-none lg:px-0 lg:py-0 lg:shadow-none"
          />
          <button
            className="mt-3 md:mt-0 md:ml-4 w-full md:w-auto uppercase text-xs tracking-widest bg-foreground text-background border border-foreground rounded-md px-6 py-3 hover:bg-foreground/90 transition-colors disabled:opacity-60 lg:bg-transparent lg:text-foreground lg:border-none lg:px-0 lg:py-0"
            disabled={newsletterSubmitting}
          >
            {newsletterSubmitting ? "Отправка..." : "Оставить контакт"}
          </button>
        </form>
        {newsletterStatus === "success" ? (
          <div className="mt-4 text-xs text-primary">Заявка отправлена. Мы свяжемся с вами.</div>
        ) : null}
        {newsletterStatus === "error" ? (
          <div className="mt-4 text-xs text-destructive">Ошибка отправки. Проверьте номер и попробуйте снова.</div>
        ) : null}
      </section>

      <Footer />
    </div>
  );
}
