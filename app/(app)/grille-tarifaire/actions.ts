"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { decimalPositif } from "@/lib/validation";
import { z } from "zod";
import { revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";

const decimalStr = decimalPositif;

const schemaTranche = z.object({
  role: z.enum(["DISTRIBUTEUR", "REVENDEUR", "CORNER", "D2C", "PROSPECT"]),
  libelle: z.string().trim().min(1, "Libellé requis").max(80),
  qteMin: z.number().int().positive("Quantité minimale requise"),
  /** null = « et au-delà ». */
  qteMax: z.number().int().positive().nullable(),
  prixUnitHT: decimalStr,
  notes: z.string().trim().max(200).nullable(),
});

export type EntreeTranche = z.input<typeof schemaTranche>;

function revalider() {
  revaliderApplication();
}

/** Ajoute une tranche à la grille tarifaire. */
export async function ajouterTranche(
  entree: EntreeTranche,
): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaTranche.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  const { qteMin, qteMax } = parsed.data;
  if (qteMax !== null && qteMax < qteMin) {
    return { ok: false, message: "La borne haute doit être ≥ à la borne basse." };
  }
  await prisma.trancheTarifaire.create({ data: parsed.data });
  revalider();
  return { ok: true, message: "Tranche ajoutée." };

  } catch (e) { return erreurAction(e); }
}

/** Met à jour des tranches existantes (diffs de l'édition inline). */
export async function modifierTranches(
  entrees: ({ id: string } & EntreeTranche)[],
): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  for (const e of entrees) {
    const parsed = schemaTranche.safeParse(e);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
    }
    if (parsed.data.qteMax !== null && parsed.data.qteMax < parsed.data.qteMin) {
      return { ok: false, message: "La borne haute doit être ≥ à la borne basse." };
    }
    await prisma.trancheTarifaire.update({ where: { id: e.id }, data: parsed.data });
  }
  revalider();
  return { ok: true, message: "Modifications enregistrées." };

  } catch (e) { return erreurAction(e); }
}

/** Supprime une tranche. */
export async function supprimerTranche(entree: {
  id: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  if (!entree.id) return { ok: false, message: "Entrée invalide." };
  await prisma.trancheTarifaire.delete({ where: { id: entree.id } }).catch(() => null);
  revalider();
  return { ok: true, message: "Tranche supprimée." };

  } catch (e) { return erreurAction(e); }
}

/** Supprime toutes les tranches d'une référence pour un rôle. */
export async function supprimerReference(entree: {
  role: "DISTRIBUTEUR" | "REVENDEUR" | "CORNER" | "D2C" | "PROSPECT";
  libelle: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  if (!entree.libelle) return { ok: false, message: "Entrée invalide." };
  const { count } = await prisma.trancheTarifaire.deleteMany({
    where: { role: entree.role, libelle: entree.libelle },
  });
  revalider();
  return count > 0
    ? { ok: true, message: `Référence supprimée (${count} tranche${count > 1 ? "s" : ""}).` }
    : { ok: false, message: "Référence introuvable." };

  } catch (e) { return erreurAction(e); }
}
