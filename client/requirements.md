## Packages
framer-motion | Complex page transitions and scroll animations
clsx | Utility for conditional classes
tailwind-merge | Utility for merging tailwind classes

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  serif: ["'Playfair Display'", "serif"],
  sans: ["'Lato'", "sans-serif"],
}

## Supabase
Env файл лежит в `client/.env` (Vite `root` = `client`).

Пример:
```ts
import { supabase } from "@/lib/supabaseClient";

const { data, error } = await supabase.from("products").select("*").limit(1);
```
