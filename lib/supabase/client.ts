import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Client Supabase pour les Client Components (navigateur). */
export function creerClientNavigateur() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
