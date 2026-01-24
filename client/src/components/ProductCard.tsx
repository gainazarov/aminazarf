import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  id: number;
  name: string;
  price: string | null;
  image?: string | null;
  categoryName?: string;
  index: number;
  inStock?: boolean;
}

export function ProductCard({ id, name, price, image, categoryName, index, inStock }: ProductCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { toast } = useToast();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+992");
  const [clientMessage, setClientMessage] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "success" | "error">("idle");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // When modal opens, prefill name/phone from localStorage (if present)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedName = localStorage.getItem("savedRequestName");
      const savedPhone = localStorage.getItem("savedRequestPhone");
      if (savedName && clientName === "") setClientName(savedName);
      // Only override phone if user hasn't changed it from default
      if (savedPhone && (clientPhone === "" || clientPhone === "+992")) setClientPhone(savedPhone);
    } catch (e) {
      // ignore localStorage errors
    }
  }, [isOpen]);

  useEffect(() => {
    if (!image) {
      setImgLoaded(true);
      return;
    }

    // Check if image is already in browser cache / loaded
    const pre = new Image();
    pre.src = image;
    if (pre.complete) {
      setImgLoaded(true);
      return;
    }

    const onLoad = () => setImgLoaded(true);
    pre.onload = onLoad;
    pre.onerror = onLoad; // on error, hide loader so UI isn't stuck

    return () => {
      pre.onload = null;
      pre.onerror = null;
    };
  }, [image]);

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
            ref={imgRef}
            src={image ?? undefined}
            alt={name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 transition-opacity duration-500 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Blurred background overlay while image loads (or on slow connections) */}
          {!imgLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xl scale-105"
                style={{ backgroundImage: image ? `url('${image}')` : undefined }}
              />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-primary rounded-full animate-spin border-t-transparent" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 pointer-events-none" />
          )}
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

          <div className="pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[10px] uppercase tracking-[0.2em] rounded-none"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
            >
              Купить
            </Button>
          </div>
        </div>
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] lg:max-w-[840px] p-0 overflow-hidden bg-background border-none rounded-lg mx-auto">
            <div className="flex flex-col md:flex-row max-h-[80vh] md:max-h-[75vh] overflow-y-auto">
              <div className="relative w-full md:w-1/2 aspect-[4/3] md:aspect-auto h-auto md:min-h-[420px]">
              <img src={image ?? undefined} alt={name} className="w-full h-full object-cover" />
            </div>
              <div className="w-full md:w-1/2 p-5 sm:p-6 md:p-8 flex flex-col justify-center">
                <DialogHeader className="mb-5 space-y-2">
                {categoryName && (
                  <p className="text-[10px] uppercase tracking-[0.3em] text-primary">
                    {categoryName}
                  </p>
                )}
                <DialogTitle className="font-serif text-2xl sm:text-3xl md:text-4xl text-foreground">
                  {name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mb-8">
                <div className="flex justify-between items-baseline border-b border-border pb-3">
                  <span className="text-muted-foreground text-xs sm:text-sm uppercase tracking-widest">Стоимость</span>
                  <span className="font-serif text-lg sm:text-xl">{price || "Цена по запросу"}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-border pb-3">
                  <span className="text-muted-foreground text-xs sm:text-sm uppercase tracking-widest">Наличие</span>
                  <span className="text-xs sm:text-sm">
                    {inStock === false ? "Нет" : "В наличии"}
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                <h4 className="font-serif text-lg sm:text-xl italic">Оставить заявку</h4>
                <form
                  className="space-y-3 sm:space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (formSubmitting) return;

                    const phone = clientPhone.trim();
                    if (!phone || phone.length < 5) {
                      setFormStatus("error");
                      toast({
                        variant: "destructive",
                        title: "Ошибка",
                        description: "Введите корректный номер телефона.",
                      });
                      return;
                    }

                    setFormSubmitting(true);
                    setFormStatus("idle");

                    const { error } = await supabase.from("requests").insert({
                      client_name: clientName || null,
                      client_phone: phone,
                      client_message: clientMessage || null,
                      product_id: id ?? null,
                      status: "new",
                      });

                    if (error) {
                      console.error("[requests] insert error", error);
                      setFormStatus("error");
                      toast({
                        variant: "destructive",
                        title: "Ошибка",
                        description: "Не удалось отправить заявку. Попробуйте позже.",
                      });
                    } else {
                      // Save name/phone for next time
                      try {
                        if (clientName) localStorage.setItem("savedRequestName", clientName);
                        if (phone) localStorage.setItem("savedRequestPhone", phone);
                      } catch (e) {
                        // ignore localStorage errors
                      }
                      setFormStatus("success");
                      toast({
                        title: "Заявка отправлена",
                        description: "Мы свяжемся с вами в ближайшее время.",
                      });
                    }

                    setFormSubmitting(false);
                  }}
                >
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ваше имя"
                    className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                  <Input
                    value={clientPhone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/[^0-9+]/g, "");
                      setClientPhone(cleaned);
                    }}
                    placeholder="Телефон"
                    inputMode="tel"
                    autoComplete="tel"
                    className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                  <Textarea
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    placeholder="(Здесь вы можете написать ваш вопрос или ваши пожелания в любом формате)"
                    className="bg-transparent border-x-0 border-t-0 border-b-border rounded-none px-0 min-h-[80px] resize-none focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                  <Button
                    type="submit"
                    disabled={formSubmitting}
                    className="w-full bg-foreground text-background hover:bg-primary transition-colors duration-500 uppercase tracking-[0.2em] text-[10px] py-4 sm:py-5 rounded-none mt-3 sm:mt-4 disabled:opacity-60"
                  >
                    {formSubmitting ? "Отправка..." : "Отправить запрос"}
                  </Button>
                  {formStatus === "success" ? (
                    <div className="space-y-2">
                      <div className="text-xs text-primary">Заявка отправлена. Мы свяжемся с вами.</div>
                      <div className="text-xs text-muted-foreground">Мы запомнили ваши данные — при следующем оформлении они будут автозаполнены, но вы сможете их отредактировать.</div>
                    </div>
                  ) : null}
                  {formStatus === "error" ? (
                    <div className="text-xs text-destructive">Ошибка отправки. Проверьте номер и попробуйте снова.</div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
