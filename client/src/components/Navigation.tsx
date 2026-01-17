import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag } from "lucide-react";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? "bg-background/80 backdrop-blur-md py-4 shadow-sm shadow-black/5" 
            : "bg-transparent py-8"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="z-50">
            <span className={`font-serif text-2xl tracking-wider font-semibold cursor-pointer ${scrolled ? 'text-foreground' : 'text-foreground'}`}>
              AMINA ZARF
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-12">
            {["Shop", "Collections", "About", "Journal"].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase()}`}
                className="text-sm uppercase tracking-widest hover:text-primary transition-colors duration-300 relative group"
              >
                {item}
                <span className="absolute -bottom-2 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-6">
            <button className="text-foreground hover:text-primary transition-colors">
              <span className="sr-only">Cart</span>
              <ShoppingBag className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center space-y-8"
          >
            {["Shop", "Collections", "About", "Journal"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-3xl font-serif text-foreground hover:text-primary transition-colors"
              >
                {item}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
