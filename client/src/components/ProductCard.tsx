import { motion } from "framer-motion";

interface ProductCardProps {
  name: string;
  price: string | null;
  image: string;
  categoryName?: string;
  index: number;
}

export function ProductCard({ name, price, image, categoryName, index }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group cursor-pointer"
    >
      <div className="relative overflow-hidden mb-4 aspect-[3/4] bg-secondary/20">
        <motion.img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />
      </div>
      
      <div className="text-center space-y-1">
        {categoryName && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            {categoryName}
          </p>
        )}
        <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors duration-300">
          {name}
        </h3>
        <p className="text-sm font-sans text-muted-foreground">{price || "Contact for price"}</p>
      </div>
    </motion.div>
  );
}
