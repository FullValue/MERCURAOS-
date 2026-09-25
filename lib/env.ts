import { z } from "zod";

/**
 * Validation des variables d'environnement (Zod, §2). Lue paresseusement pour
 * ne pas casser les commandes hors-ligne (prisma generate, tests unitaires).
 */
const schemaServeur = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CHIFFREMENT_CLE: z.string().min(1).optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
});

export type EnvServeur = z.infer<typeof schemaServeur>;

let cache: EnvServeur | null = null;

export function env(): EnvServeur {
  if (cache) return cache;
  const parsed = schemaServeur.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement invalides : ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
    );
  }
  cache = parsed.data;
  return cache;
}

/** Valeurs publiques utilisables côté client (préfixe NEXT_PUBLIC). */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
