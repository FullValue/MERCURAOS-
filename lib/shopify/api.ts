import { prisma } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement";

const VERSION_API = "2024-10";

/** Réglages Shopify courants (singleton). */
export async function chargerReglages() {
  return prisma.reglageShopify.findFirst();
}

async function jetonEnClair(): Promise<{ domaine: string; jeton: string } | null> {
  const reglages = await chargerReglages();
  if (!reglages?.domaine || !reglages.jetonChiffre) return null;
  return { domaine: reglages.domaine, jeton: dechiffrer(reglages.jetonChiffre) };
}

async function requeteAdmin(chemin: string): Promise<Response | null> {
  const acces = await jetonEnClair();
  if (!acces) return null;
  return fetch(`https://${acces.domaine}/admin/api/${VERSION_API}/${chemin}`, {
    headers: {
      "X-Shopify-Access-Token": acces.jeton,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

/** Teste la connexion (§10) : lit la fiche boutique. */
export async function testerConnexion(): Promise<{ ok: boolean; message: string }> {
  try {
    const reponse = await requeteAdmin("shop.json");
    if (!reponse) return { ok: false, message: "Domaine ou jeton non renseignés." };
    if (reponse.status === 401 || reponse.status === 403) {
      return { ok: false, message: "Jeton refusé par Shopify (401/403)." };
    }
    if (!reponse.ok) {
      return { ok: false, message: `Réponse Shopify inattendue (${reponse.status}).` };
    }
    const corps = (await reponse.json()) as { shop?: { name?: string } };
    return {
      ok: true,
      message: `Connexion établie avec « ${corps.shop?.name ?? "boutique"} ».`,
    };
  } catch {
    return { ok: false, message: "Connexion impossible (réseau ou domaine invalide)." };
  }
}

/**
 * Liste les commandes des 60 derniers jours (repli de synchronisation, §10).
 * Le scope read_orders ne remonte que 60 jours ; au-delà, le scope protégé
 * read_all_orders est requis — signalé dans l'interface.
 */
export async function listerCommandes60Jours(): Promise<
  { ok: true; commandes: unknown[] } | { ok: false; message: string }
> {
  const depuis = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const reponse = await requeteAdmin(
    `orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(depuis)}`,
  );
  if (!reponse) return { ok: false, message: "Domaine ou jeton non renseignés." };
  if (!reponse.ok) {
    return { ok: false, message: `Réponse Shopify inattendue (${reponse.status}).` };
  }
  const corps = (await reponse.json()) as { orders?: unknown[] };
  return { ok: true, commandes: corps.orders ?? [] };
}
