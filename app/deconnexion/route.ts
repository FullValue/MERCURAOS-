import { NextResponse, type NextRequest } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Déconnexion (infra d'auth). POST uniquement : une route GET serait
 * préchargée par les <Link> de Next.js, ce qui déconnectait l'utilisateur
 * à l'affichage de la barre latérale.
 */
export async function POST(request: NextRequest) {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  // 303 : le navigateur enchaîne sur un GET /connexion (pas de re-POST).
  return NextResponse.redirect(new URL("/connexion", request.nextUrl.origin), 303);
}
