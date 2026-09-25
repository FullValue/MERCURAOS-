"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { decimalPositif, dateSaisie } from "@/lib/validation";
import { z } from "zod";
import { revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";

const schemaCharge = z.object({
  libelle: z.string().min(1, "Libellé requis"),
  montantHT: decimalPositif,
  periodicite: z.enum(["PONCTUELLE", "MENSUELLE", "ANNUELLE"]),
  date: dateSaisie,
});

/** Ajoute une charge globale (loyer, salon, abonnements…). */
export async function ajouterChargeGlobale(entree: {
  libelle: string;
  montantHT: string;
  periodicite: string;
  date: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaCharge.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  await prisma.charge.create({
    data: {
      libelle: parsed.data.libelle,
      montantHT: parsed.data.montantHT,
      periodicite: parsed.data.periodicite,
      rattachement: "GLOBALE",
      date: new Date(parsed.data.date),
    },
  });
  revaliderApplication();
  return { ok: true, message: "Charge ajoutée." };

  } catch (e) { return erreurAction(e); }
}

/** Supprime une charge globale. */
export async function supprimerChargeGlobale(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const r = await prisma.charge.deleteMany({ where: { id, rattachement: "GLOBALE" } });
  if (!r.count) return { ok: false, message: "Charge globale introuvable." };
  revaliderApplication();
  return { ok: true, message: "Charge supprimée." };

  } catch (e) { return erreurAction(e); }
}
