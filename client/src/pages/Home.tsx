import { useState } from "react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useProducts, useProductsByCategory } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Data Fetching
  const { data: categories } = useCategories();
  const { data: allProducts, isLoading: loadingAll } = useProducts();
  const { data: catProducts, isLoading: loadingCat } = useProductsByCategory(activeCategory);

  const displayedProducts = activeCategory ? catProducts : allProducts;
  const isLoading = activeCategory ? loadingCat : loadingAll;

  // Static images for Hero and Featured sections
  const heroImage = "/images/hero.jpg";
  const featuredImage = "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2000&auto=format&fit=crop"; 

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Navigation />

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
            Посуда ручной работы
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
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-sm uppercase tracking-widest transition-all duration-300 pb-2 border-b border-transparent ${
              activeCategory === null 
                ? "text-primary border-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Все
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`text-sm uppercase tracking-widest transition-all duration-300 pb-2 border-b border-transparent ${
                activeCategory === cat.slug 
                  ? "text-primary border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce mr-1"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce mr-1 delay-100"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {displayedProducts?.map((product, idx) => (
              <ProductCard
                key={product.id}
                index={idx}
                name={product.name}
                price={product.price}
                image={product.image}
                categoryName={categories?.find(c => c.id === product.categoryId)?.name}
              />
            ))}
          </div>
        )}
      </section>

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
                Каждое изделие в нашей коллекции несет на себе отпечаток руки мастера, обладая душой, которую массовое производство просто не может воспроизвести.
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

      {/* GIFT CARD / MINIMAL BLOCK */}
      <section className="py-32 container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center border border-border p-12 md:p-20 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-6">
            <span className="font-serif text-2xl italic">Подарки</span>
          </div>
          
          <h3 className="text-xl font-medium tracking-wide mb-6 uppercase text-foreground/80">
            Цифровая подарочная карта
          </h3>
          <p className="text-muted-foreground mb-10">
            Для тех, кто любит принимать гостей, создавая пространство тепла и встреч.
          </p>
          <button className="bg-foreground text-background px-10 py-4 uppercase tracking-widest text-xs hover:bg-primary transition-colors duration-300">
            Купить карту
          </button>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="pb-32 container mx-auto px-6 text-center">
        <h3 className="font-serif text-3xl mb-4">Присоединяйтесь к нам</h3>
        <p className="text-muted-foreground mb-8 text-sm">Подпишитесь на новости о новых коллекциях и событиях студии.</p>
        <form className="max-w-md mx-auto flex border-b border-border pb-2" onSubmit={(e) => e.preventDefault()}>
          <input 
            type="email" 
            placeholder="Введите ваш email" 
            className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/50 text-center"
          />
          <button className="uppercase text-xs tracking-widest text-foreground hover:text-primary transition-colors">
            Подписаться
          </button>
        </form>
      </section>

      <Footer />
    </div>
  );
}
