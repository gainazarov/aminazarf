import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get(api.products.getByCategory.path, async (req, res) => {
    const products = await storage.getProductsByCategory(req.params.slug);
    res.json(products);
  });

  app.get(api.categories.list.path, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  // Seed data on startup
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingCategories = await storage.getCategories();
  if (existingCategories.length === 0) {
    const cats = [
      { name: "Ceramics", slug: "ceramics" },
      { name: "Glassware", slug: "glassware" },
      { name: "Linens", slug: "linens" },
      { name: "Decor", slug: "decor" },
    ];
    await storage.seedCategories(cats);
    
    // Fetch back to get IDs
    const savedCats = await storage.getCategories();
    const catMap = new Map(savedCats.map(c => [c.slug, c.id]));

    const products = [
      { 
        name: "Artisan Clay Plate", 
        description: "Hand-thrown ceramic plate with a raw edge finish.", 
        price: "$45", 
        image: "/images/ceramics.jpg", 
        categoryId: catMap.get("ceramics") 
      },
      { 
        name: "Stoneware Bowl", 
        description: "Deep bowl for soups and stews, matte glaze.", 
        price: "$38", 
        image: "/images/ceramics.jpg", 
        categoryId: catMap.get("ceramics") 
      },
      { 
        name: "Crystal Wine Glass", 
        description: "Lead-free crystal glass with a delicate stem.", 
        price: "$60", 
        image: "/images/glassware.jpg", 
        categoryId: catMap.get("glassware") 
      },
      { 
        name: "Linen Table Runner", 
        description: "100% organic linen in natural oatmeal color.", 
        price: "$85", 
        image: "/images/ceramics.jpg", // Using ceramics image as placeholder for linen context
        categoryId: catMap.get("linens") 
      },
       { 
        name: "Minimalist Vase", 
        description: "Hand-blown glass vase for dry arrangements.", 
        price: "$120", 
        image: "/images/decor.jpg", 
        categoryId: catMap.get("decor") 
      },
    ];
    await storage.seedProducts(products);
  }
}
