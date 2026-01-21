import { motion } from "framer-motion";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProductCardProps {
  name: string;
  price: string | null;
  image: string;
  categoryName?: string;
  index: number;
}

export function ProductCard({ name, price, image, categoryName, index }: ProductCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, delay: index * 0.1 }}
        className="group cursor-pointer"
        onClick={() => setIsOpen(true)}
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
          <p className="text-sm font-sans text-muted-foreground">{price || "Цена по запросу"}</p>
        </div>
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[800px] p-0 overflow-hidden bg-background border-none rounded-none md:rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[80vh] md:h-auto overflow-y-auto">
            <div className="relative aspect-[3/4] md:aspect-auto h-64 md:h-full">
              <img src={image} alt={name} className="w-full h-full object-cover" />
            </div>
            <div className="p-6 md:p-12 flex flex-col justify-center">
              <DialogHeader className="mb-6 space-y-2">
                {categoryName && (
                  <p className="text-[10px] uppercase tracking-[0.3em] text-primary">
                    {categoryName}
                  </p>
                )}
                <DialogTitle className="font-serif text-3xl md:text-4xl text-foreground">
                  {name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mb-10">
                <div className="flex justify-between items-baseline border-b border-border pb-4">
                  <span className="text-muted-foreground text-sm uppercase tracking-widest">Стоимость</span>
                  <span className="font-serif text-2xl">{price || "Цена по запросу"}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-border pb-4">
                  <span className="text-muted-foreground text-sm uppercase tracking-widest">Наличие</span>
                  <span className="text-sm">В наличии</span>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-serif text-xl italic">Оставить заявку</h4>
                <div className="space-y-4">
                  <Input placeholder="Ваше имя" className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors" />
                  <Input placeholder="Email или Телефон" className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors" />
                  <Textarea placeholder="Ваше сообщение" className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 min-h-[80px] resize-none focus-visible:ring-0 focus-visible:border-primary transition-colors" />
                  <Button className="w-full bg-foreground text-background hover:bg-primary transition-colors duration-500 uppercase tracking-[0.2em] text-[10px] py-6 rounded-none mt-4">
                    Отправить запрос
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
