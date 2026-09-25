"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { decimalPositif, dateSaisie } from "@/lib/validation";
import { z } from "zod";
import { ErreurMetier, revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";
import {
  CLE_FRAIS_LIVRAISON,
  CLE_FRAIS_LIVRAISON_TTC,
  CLE_LIVRAISON_NB_PIECES,
  CLE_TAUX_PERTE,
  CLE_TVA_RECUPERABLE,
} from "@/lib/calcul/cout";

const decimalStr = decimalPositif;

const schema = z.object({
  /** Période (commande fournisseur) dans laquelle dater les valeurs. Absente = maintenant. */
  periodeId: z.string().optional(),
  tauxPerte: decimalStr.refine((s) => Number(s) <= 1, "Le taux de perte doit être compris entre 0 et 1.").optional(),
  /** Facultatif : on n'envoie la valeur que si elle a été modifiée. */
  fraisLivraison: decimalStr.optional(),
  /** Le montant de livraison saisi est TTC. */
  fraisLivraisonTtc: z.boolean().optional(),
  /** Nombre de pièces livrées (base de répartition de la livraison). */
  livraisonNbPieces: z.number().int().positive().nullable().optional(),
  /** TVA récupérable : non = les montants TTC comptent en entier. */
  tvaRecuperable: z.boolean().optional(),
  prixLiquides: z
    .array(
      z.object({
        parfumId: z.string().min(1),
        prixLitreHT: decimalStr,
        /** Litres commandés ; null = effacer, absent = ne pas toucher. */
        litresCommandes: decimalStr.nullable().optional(),
        tvaIncluse: z.boolean().optional(),
      }),
    )
    .default([]),
  composants: z
    .array(
      z.object({
        formatId: z.string().min(1),
        libelle: z.string().min(1),
        coutUnitHT: decimalStr,
        /** Quantité commandée ; null = effacer, absent = ne pas toucher. */
        qteCommandee: z.number().int().nonnegative().nullable().optional(),
        tvaIncluse: z.boolean().optional(),
        faconnage: z.boolean().optional(),
        /** Description libre (ligne façonnage) ; absent = ne pas toucher. */
        description: z.string().max(200).nullable().optional(),
      }),
    )
    .default([]),
  /** Renommages de lignes de composants (appliqués à tout l'historique). */
  renommages: z
    .array(
      z.object({
        formatId: z.string().min(1),
        ancienLibelle: z.string().min(1),
        nouveauLibelle: z.string().trim().min(1).max(60),
      }),
    )
    .default([]),
  faconnages: z
    .array(
      z.object({
        formatId: z.string().min(1),
        coutFixeSerie: decimalStr,
        coutVarUnitHT: decimalStr,
        qteLotRef: z.number().int().positive(),
      }),
    )
    .default([]),
});

export type EntreeMajParametres = z.input<typeof schema>;

function revalider() {
  revaliderApplication();
}

/**
 * Enregistre les modifications de paramètres.
 * Sans période : chaque changement crée une NOUVELLE ligne datée de maintenant
 * — jamais d'écrasement (§4). Avec une période (commande fournisseur), les
 * valeurs sont datées de la période ; une valeur déjà saisie à cette date
 * exacte est corrigée sur place (la période reste UNE photographie).
 */
export async function enregistrerParametres(
  entree: EntreeMajParametres,
): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: "Valeurs invalides." };
  }
  const {
    periodeId,
    tauxPerte,
    fraisLivraison,
    fraisLivraisonTtc,
    livraisonNbPieces,
    tvaRecuperable,
    prixLiquides,
    composants,
    faconnages,
    renommages,
  } = parsed.data;

  let dateEffet = new Date();
  if (periodeId) {
    const periode = await prisma.periodeCouts.findUnique({ where: { id: periodeId } });
    if (!periode) return { ok: false, message: "Période introuvable." };
    dateEffet = periode.dateEffet;
  }

  await prisma.$transaction(async (tx) => {
    for (const r of renommages) {
      if (r.ancienLibelle !== r.nouveauLibelle && await tx.composant.findFirst({ where: { formatId: r.formatId, libelle: r.nouveauLibelle } })) {
        throw new ErreurMetier("Ce libellé existe déjà pour ce format.");
      }
      await tx.composant.updateMany({
        where: { formatId: r.formatId, libelle: r.ancienLibelle },
        data: { libelle: r.nouveauLibelle },
      });
    }
    if (tauxPerte !== undefined) {
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle: CLE_TAUX_PERTE, dateEffet } },
        update: { valeur: tauxPerte },
        create: { cle: CLE_TAUX_PERTE, valeur: tauxPerte, dateEffet },
      });
    }
    if (fraisLivraison !== undefined) {
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle: CLE_FRAIS_LIVRAISON, dateEffet } },
        update: { valeur: fraisLivraison },
        create: { cle: CLE_FRAIS_LIVRAISON, valeur: fraisLivraison, dateEffet },
      });
    }
    if (fraisLivraisonTtc !== undefined) {
      const valeur = fraisLivraisonTtc ? "1" : "0";
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle: CLE_FRAIS_LIVRAISON_TTC, dateEffet } },
        update: { valeur },
        create: { cle: CLE_FRAIS_LIVRAISON_TTC, valeur, dateEffet },
      });
    }
    if (livraisonNbPieces !== undefined) {
      const valeur = livraisonNbPieces === null ? "0" : String(livraisonNbPieces);
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle: CLE_LIVRAISON_NB_PIECES, dateEffet } },
        update: { valeur },
        create: { cle: CLE_LIVRAISON_NB_PIECES, valeur, dateEffet },
      });
    }
    if (tvaRecuperable !== undefined) {
      const valeur = tvaRecuperable ? "1" : "0";
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle: CLE_TVA_RECUPERABLE, dateEffet } },
        update: { valeur },
        create: { cle: CLE_TVA_RECUPERABLE, valeur, dateEffet },
      });
    }
    for (const p of prixLiquides) {
      const litres = p.litresCommandes === undefined ? {} : { litresCommandes: p.litresCommandes };
      const tva = p.tvaIncluse === undefined ? {} : { tvaIncluse: p.tvaIncluse };
      await tx.prixLiquide.upsert({
        where: { parfumId_dateEffet: { parfumId: p.parfumId, dateEffet } },
        update: { prixLitreHT: p.prixLitreHT, ...litres, ...tva },
        create: {
          parfumId: p.parfumId,
          prixLitreHT: p.prixLitreHT,
          litresCommandes: p.litresCommandes ?? null,
          tvaIncluse: p.tvaIncluse ?? false,
          dateEffet,
        },
      });
    }
    for (const c of composants) {
      const memePeriode = await tx.composant.findFirst({
        where: { formatId: c.formatId, libelle: c.libelle, dateEffet },
      });
      const qte = c.qteCommandee === undefined ? {} : { qteCommandee: c.qteCommandee };
      const tvaC = c.tvaIncluse === undefined ? {} : { tvaIncluse: c.tvaIncluse };
      const desc = c.description === undefined ? {} : { description: c.description };
      const classement = c.faconnage === undefined ? {} : { faconnage: c.faconnage };
      if (memePeriode) {
        await tx.composant.update({
          where: { id: memePeriode.id },
          data: { coutUnitHT: c.coutUnitHT, ...qte, ...tvaC, ...desc, ...classement },
        });
        continue;
      }
      // Copie `optionnel` depuis la ligne la plus récente de ce composant.
      const dernier = await tx.composant.findFirst({
        where: { formatId: c.formatId, libelle: c.libelle, dateEffet: { lte: dateEffet } },
        orderBy: { dateEffet: "desc" },
      });
      await tx.composant.create({
        data: {
          libelle: c.libelle,
          formatId: c.formatId,
          coutUnitHT: c.coutUnitHT,
          optionnel: dernier?.optionnel ?? false,
          qteCommandee: c.qteCommandee ?? null,
          tvaIncluse: c.tvaIncluse ?? dernier?.tvaIncluse ?? false,
          faconnage: c.faconnage ?? dernier?.faconnage ?? false,
          description: c.description ?? dernier?.description ?? null,
          dateEffet,
        },
      });
    }
    for (const f of faconnages) {
      const memePeriode = await tx.faconnage.findFirst({
        where: { formatId: f.formatId, dateEffet },
      });
      if (memePeriode) {
        await tx.faconnage.update({
          where: { id: memePeriode.id },
          data: {
            coutFixeSerie: f.coutFixeSerie,
            coutVarUnitHT: f.coutVarUnitHT,
            qteLotRef: f.qteLotRef,
          },
        });
        continue;
      }
      await tx.faconnage.create({
        data: {
          formatId: f.formatId,
          coutFixeSerie: f.coutFixeSerie,
          coutVarUnitHT: f.coutVarUnitHT,
          qteLotRef: f.qteLotRef,
          dateEffet,
        },
      });
    }
  });

  revalider();
  return { ok: true, message: "Modifications enregistrées." };

  } catch (e) { return erreurAction(e); }
}

const schemaPeriode = z.object({
  libelle: z.string().trim().min(1, "Libellé requis").max(80),
  /** Date d'effet au format YYYY-MM-DD (défaut : aujourd'hui). */
  date: dateSaisie.optional(),
});

/**
 * Crée une période de coûts (commande fournisseur). Les valeurs saisies dans
 * cette période prendront effet à sa date.
 */
export async function creerPeriode(entree: {
  libelle: string;
  date?: string;
}): Promise<{ ok: boolean; message: string; id?: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaPeriode.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  const dateEffet = parsed.data.date
    ? new Date(`${parsed.data.date}T00:00:00.000Z`)
    : new Date();

  const existante = await prisma.periodeCouts.findUnique({ where: { dateEffet } });
  if (existante) {
    return { ok: false, message: `Une période existe déjà à cette date (${existante.libelle}).` };
  }

  const periode = await prisma.periodeCouts.create({
    data: { libelle: parsed.data.libelle, dateEffet },
  });

  revalider();
  return { ok: true, message: "Période créée.", id: periode.id };

  } catch (e) { return erreurAction(e); }
}

const schemaNouveauComposant = z.object({
  periodeId: z.string().optional(),
  formatId: z.string().min(1),
  libelle: z.string().trim().min(1, "Libellé requis").max(60),
  coutUnitHT: decimalStr,
  optionnel: z.boolean().default(false),
  faconnage: z.boolean().default(false),
});

/** Ajoute une ligne de composant à un format, datée de la période choisie. */
export async function ajouterComposant(entree: {
  periodeId?: string;
  formatId: string;
  libelle: string;
  coutUnitHT: string;
  optionnel?: boolean;
  faconnage?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaNouveauComposant.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  const { periodeId, formatId, libelle, coutUnitHT, optionnel, faconnage } = parsed.data;

  const existant = await prisma.composant.findFirst({ where: { formatId, libelle } });
  if (existant) {
    return { ok: false, message: "Une ligne porte déjà ce libellé pour ce format." };
  }

  let dateEffet = new Date();
  if (periodeId) {
    const periode = await prisma.periodeCouts.findUnique({ where: { id: periodeId } });
    if (!periode) return { ok: false, message: "Période introuvable." };
    dateEffet = periode.dateEffet;
  }

  await prisma.composant.create({
    data: { formatId, libelle, coutUnitHT, optionnel, faconnage: optionnel ? false : faconnage, dateEffet },
  });
  revalider();
  return { ok: true, message: "Ligne ajoutée." };

  } catch (e) { return erreurAction(e); }
}

/**
 * Supprime une ligne de composant (tout son historique, toutes périodes).
 * Les coûts figés des commandes confirmées ne sont pas affectés.
 */
export async function supprimerComposant(entree: {
  formatId: string;
  libelle: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const { formatId, libelle } = entree;
  if (!formatId || !libelle) return { ok: false, message: "Entrée invalide." };
  const { count } = await prisma.composant.deleteMany({ where: { formatId, libelle } });
  revalider();
  return count > 0
    ? { ok: true, message: "Ligne supprimée." }
    : { ok: false, message: "Ligne introuvable." };

  } catch (e) { return erreurAction(e); }
}

const schemaCoutVariable = z.object({
  periodeId: z.string().optional(),
  libelle: z.string().trim().min(1, "Libellé requis").max(80),
  montant: decimalStr,
  tvaIncluse: z.boolean().default(false),
});

/**
 * Ajoute (ou remplace, à libellé identique) un coût variable de la commande
 * fournisseur, daté de la période choisie. Réparti sur le nombre de pièces
 * livrées, avec la livraison.
 */
export async function ajouterCoutVariable(entree: {
  periodeId?: string;
  libelle: string;
  montant: string;
  tvaIncluse?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaCoutVariable.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  const { periodeId, libelle, montant, tvaIncluse } = parsed.data;

  let dateEffet = new Date();
  if (periodeId) {
    const periode = await prisma.periodeCouts.findUnique({ where: { id: periodeId } });
    if (!periode) return { ok: false, message: "Période introuvable." };
    dateEffet = periode.dateEffet;
  }

  await prisma.coutVariable.upsert({
    where: { libelle_dateEffet: { libelle, dateEffet } },
    update: { montant, tvaIncluse },
    create: { libelle, montant, tvaIncluse, dateEffet },
  });
  revalider();
  return { ok: true, message: "Coût variable enregistré." };

  } catch (e) { return erreurAction(e); }
}

/** Supprime un coût variable (la ligne de cette période uniquement). */
export async function supprimerCoutVariable(entree: {
  id: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  if (!entree.id) return { ok: false, message: "Entrée invalide." };
  const r = await prisma.coutVariable.deleteMany({ where: { id: entree.id } });
  if (!r.count) return { ok: false, message: "Coût variable introuvable." };
  revalider();
  return { ok: true, message: "Coût variable supprimé." };

  } catch (e) { return erreurAction(e); }
}

const nomReference = z.string().trim().min(1).max(100);
const identifiant = z.string().uuid();
const skuReference = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "SKU invalide.");

/** Les références se créent ici ou par le seed Mercura idempotent. */
export async function creerFormat(entree: { libelle: string; volumeMl: string }) {
  await exigerUtilisateur();
  try {
    const parsed = z.object({ libelle: nomReference, volumeMl: decimalPositif }).safeParse(entree);
    if (!parsed.success || Number(parsed.data.volumeMl) <= 0) return { ok: false, message: "Format ou volume invalide." };
    await prisma.format.create({ data: { libelle: parsed.data.libelle, volumeL: new (await import("decimal.js")).default(parsed.data.volumeMl).div(1000).toString() } });
    revalider();
    return { ok: true, message: "Format créé." };
  } catch (e) { return erreurAction(e); }
}

export async function creerParfum(entree: { nom: string; prixLiquideL?: string }) {
  await exigerUtilisateur();
  try {
    const parsed = z.object({ nom: nomReference, prixLiquideL: decimalPositif.optional().or(z.literal("")) }).safeParse(entree);
    if (!parsed.success) return { ok: false, message: "Parfum ou prix invalide." };
    await prisma.parfum.create({ data: { nom: parsed.data.nom, prixLiquideL: parsed.data.prixLiquideL || "0" } });
    revalider();
    return { ok: true, message: "Parfum créé." };
  } catch (e) { return erreurAction(e); }
}

export async function creerProduit(entree: { parfumId: string; formatId: string; sku: string; skuShopify?: string }) {
  await exigerUtilisateur();
  try {
    const parsed = z.object({ parfumId: identifiant, formatId: identifiant, sku: skuReference, skuShopify: skuReference.optional().or(z.literal("")) }).safeParse(entree);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Référence invalide." };
    await prisma.produit.create({ data: { parfumId: parsed.data.parfumId, formatId: parsed.data.formatId, sku: parsed.data.sku, skuShopify: parsed.data.skuShopify || null } });
    revalider();
    return { ok: true, message: "Référence créée." };
  } catch (e) { return erreurAction(e); }
}

export async function modifierProduit(entree: { id: string; sku: string; skuShopify?: string; actif: boolean }) {
  await exigerUtilisateur();
  try {
    const parsed = z.object({ id: identifiant, sku: skuReference, skuShopify: skuReference.optional().or(z.literal("")), actif: z.boolean() }).safeParse(entree);
    if (!parsed.success) return { ok: false, message: "Référence invalide." };
    await prisma.produit.update({ where: { id: parsed.data.id }, data: { sku: parsed.data.sku, skuShopify: parsed.data.skuShopify || null, actif: parsed.data.actif } });
    revalider();
    return { ok: true, message: "Référence mise à jour." };
  } catch (e) { return erreurAction(e); }
}
