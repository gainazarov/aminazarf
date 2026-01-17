import { products, categories, type Product, type InsertProduct, type Category, type InsertCategory } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Product & Category methods
  getCategories(): Promise<Category[]>;
  getProducts(): Promise<Product[]>;
  getProductsByCategory(categorySlug: string): Promise<Product[]>;
  seedCategories(categories: InsertCategory[]): Promise<void>;
  seedProducts(products: InsertProduct[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProductsByCategory(categorySlug: string): Promise<Product[]> {
    // Join or two queries. Simple two queries for now or subquery.
    const [category] = await db.select().from(categories).where(eq(categories.slug, categorySlug));
    if (!category) return [];
    
    return await db.select().from(products).where(eq(products.categoryId, category.id));
  }

  async seedCategories(items: InsertCategory[]): Promise<void> {
    if (items.length === 0) return;
    await db.insert(categories).values(items).onConflictDoNothing();
  }

  async seedProducts(items: InsertProduct[]): Promise<void> {
    if (items.length === 0) return;
    await db.insert(products).values(items).onConflictDoNothing();
  }
}

export const storage = new DatabaseStorage();
