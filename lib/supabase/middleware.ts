import { fetchAuth } from "./fetch";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes.
 * Seul le compte Auth lié au code PIN peut ouvrir l'espace.
 */
export async function actualiserSession(request: NextRequest) {
  const chemin = request.nextUrl.pathname;
  // Connexion et webhooks n'ont pas besoin d'une validation de session réseau.
  if (chemin === "/connexion" || chemin.startsWith("/auth/") || chemin === "/api/shopify/webhook") {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchAuth },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const comptePin = process.env.PIN_COMPTE_EMAIL?.trim().toLowerCase();
  if (!comptePin || user?.email?.toLowerCase() !== comptePin) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    const redirection = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirection.cookies.set(cookie);
    return redirection;
  }

  return response;
}
