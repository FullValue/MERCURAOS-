"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { decimalPositif } from "@/lib/validation";
import { z } from "zod";
import { revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { chiffrer } from "@/lib/chiffrement";
import { listerCommandes60Jours, testerConnexion } from "@/lib/shopify/api";
import {
  ingererCommandeShopify,
  type CommandeShopify,
} from "@/lib/shopify/ingestion";

const schemaReglages = z.object({
  domaine: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+\.myshopify\.com$/i, "Domaine attendu : boutique.myshopify.com")
    .optional()
    .or(z.literal("")),
  jeton: z.string().trim().optional(),
  commissionTauxPct: decimalPositif.refine((s) => Number(s) <= 100, "Taux supérieur à 100 %."),
  commissionFixe: decimalPositif,
});

/** Enregistre les réglages. Le jeton est chiffré et jamais renvoyé en clair (§10). */
export async function enregistrerReglages(entree: {
  domaine: string;
  jeton?: string;
  commissionTauxPct: string;
  commissionFixe: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaReglages.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  const { domaine, jeton, commissionTauxPct, commissionFixe } = parsed.data;

  const existant = await prisma.reglageShopify.findFirst();
  const donnees = {
    domaine: domaine || null,
    commissionTauxPct,
    commissionFixe,
    // Jeton fourni → chiffré ; champ vide → on conserve l'existant.
    ...(jeton ? { jetonChiffre: chiffrer(jeton) } : {}),
  };

  if (existant) {
    await prisma.reglageShopify.update({ where: { id: existant.id }, data: donnees });
  } else {
    await prisma.reglageShopify.create({ data: donnees });
  }
  revaliderApplication();
  return { ok: true, message: "Réglages enregistrés." };

  } catch (e) { return erreurAction(e); }
}

/** Bouton « tester la connexion » (§10). */
export async function testerConnexionShopify(): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  return testerConnexion();

  } catch (e) { return erreurAction(e); }
}

/** Synchronisation manuelle des 60 derniers jours (§10). */
export async function synchroniserShopify(): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const resultat = await listerCommandes60Jours();
  if (!resultat.ok) return { ok: false, message: resultat.message };

  let ingerees = 0;
  let dejaConnues = 0;
  let enFile = 0;
  let erreurs = 0;
  for (const brute of resultat.commandes) {
    const r = await ingererCommandeShopify(brute as CommandeShopify);
    if (r.statut === "ingeree") ingerees++;
    else if (r.statut === "deja_connue") dejaConnues++;
    else if (r.statut === "sku_a_mapper") enFile++;
    else if (r.statut === "erreur") erreurs++;
  }
  revaliderApplication();
  return {
    ok: erreurs === 0,
    message: `${erreurs} erreur(s), ${ingerees} ingérée(s), ${dejaConnues} déjà connue(s), ${enFile} en file « SKU à mapper ».`,
  };

  } catch (e) { return erreurAction(e); }
}

const schemaResolution = z.object({
  skuAMapperId: z.string().min(1),
  produitId: z.string().min(1),
});

/**
 * Rapproche un SKU Shopify d'un produit du catalogue puis relance l'ingestion
 * de la commande en attente (§10 : jamais ignorée silencieusement).
 */
export async function resoudreSku(entree: {
  skuAMapperId: string;
  produitId: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaResolution.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Sélection invalide." };

  const enAttente = await prisma.skuAMapper.findUnique({
    where: { id: parsed.data.skuAMapperId },
  });
  if (!enAttente || enAttente.resolu) {
    return { ok: false, message: "Ligne introuvable ou déjà résolue." };
  }

  // Mémorise le rapprochement sur le produit pour les prochaines commandes.
  await prisma.produit.update({
    where: { id: parsed.data.produitId },
    data: { skuShopify: enAttente.skuShopify },
  });
  await prisma.skuAMapper.update({
    where: { id: enAttente.id },
    data: { resolu: true, produitId: parsed.data.produitId },
  });

  // Retente l'ingestion de la commande d'origine.
  const r = await ingererCommandeShopify(
    enAttente.payload as unknown as CommandeShopify,
  );
  revaliderApplication();
  if (r.statut === "ingeree") {
    return { ok: true, message: `SKU rapproché, commande ${r.reference} ingérée.` };
  }
  if (r.statut === "sku_a_mapper") {
    return { ok: true, message: "SKU rapproché ; la commande attend d'autres rapprochements." };
  }
  if (r.statut === "deja_connue") {
    return { ok: true, message: "SKU rapproché ; commande déjà ingérée." };
  }
  return { ok: false, message: r.message };

  } catch (e) { return erreurAction(e); }
}
