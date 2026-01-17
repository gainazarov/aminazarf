export function Footer() {
  return (
    <footer className="bg-secondary/30 pt-24 pb-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-serif text-2xl mb-6">AMINA ZARF</h3>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Curating moments of stillness through handmade ceramics, glassware, and table linens. 
              Designed for the art of slow living.
            </p>
          </div>
          
          <div>
            <h4 className="uppercase text-xs tracking-[0.2em] mb-6 text-foreground font-semibold">Explore</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Shop All</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">New Arrivals</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Journal</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
            </ul>
          </div>

          <div>
            <h4 className="uppercase text-xs tracking-[0.2em] mb-6 text-foreground font-semibold">Contact</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Pinterest</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Email Us</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground/60 uppercase tracking-wider">
          <p>&copy; 2024 Amina Zarf. All rights reserved.</p>
          <p className="mt-4 md:mt-0 font-medium">Designed with brain. Built with heart. — Gainazarov</p>
        </div>
      </div>
    </footer>
  );
}
