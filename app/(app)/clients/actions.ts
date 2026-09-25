"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { decimalPositif } from "@/lib/validation";
import { z } from "zod";
import { revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";

const decimalStr = decimalPositif;

const schemaGrille = z.object({
  clientId: z.string().min(1),
  lignes: z.array(
    z.object({
      produitId: z.string().min(1),
      prixCessionHT: decimalStr,
    }),
  ),
});

/**
 * Met à jour la grille tarifaire : chaque changement INSÈRE une nouvelle ligne
 * datée (jamais de modification d'une ligne existante, §4).
 */
export async function enregistrerGrille(entree: {
  clientId: string;
  lignes: { produitId: string; prixCessionHT: string }[];
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaGrille.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Valeurs invalides." };

  const maintenant = new Date();
  await prisma.$transaction(
    parsed.data.lignes.map((l) =>
      prisma.grillePrix.create({
        data: {
          clientId: parsed.data.clientId,
          produitId: l.produitId,
          prixCessionHT: l.prixCessionHT,
          dateEffet: maintenant,
        },
      }),
    ),
  );

  revaliderApplication();
  return { ok: true, message: "Grille mise à jour." };

  } catch (e) { return erreurAction(e); }
}

const schemaConditions = z.object({
  clientId: z.string().min(1),
  notes: z.string().max(4000),
});

/** Enregistre l'encart « conditions » (exclusivité, franco, minimum…). */
export async function enregistrerConditions(entree: {
  clientId: string;
  notes: string;
}): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaConditions.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Texte invalide." };

  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: { notes: parsed.data.notes },
  });
  revaliderApplication();
  return { ok: true, message: "Conditions enregistrées." };

  } catch (e) { return erreurAction(e); }
}

const schemaClient = z.object({
  nom: z.string().trim().min(1, "Le nom est requis"),
  contact: z.string().optional(),
  email: z.string().email("E-mail invalide").optional().or(z.literal("")),
  ville: z.string().optional(),
  roles: z.array(
    z.enum(["DISTRIBUTEUR", "REVENDEUR", "CORNER", "D2C", "PROSPECT"]),
  ),
});

/** Crée un client avec ses rôles. */
export async function creerClient(entree: {
  nom: string;
  contact?: string;
  email?: string;
  ville?: string;
  roles: string[];
}): Promise<{ ok: boolean; message: string; id?: string }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaClient.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  const { nom, contact, email, ville, roles } = parsed.data;
  try {
    const client = await prisma.client.create({
      data: {
        nom,
        contact: contact || null,
        email: email || null,
        ville: ville || null,
        roles: { create: [...new Set(roles)].map((role) => ({ role })) },
      },
    });
    revaliderApplication();
    return { ok: true, message: "Client créé.", id: client.id };
  } catch {
    return { ok: false, message: "Ce nom de client existe déjà." };
  }

  } catch (e) { return erreurAction(e); }
}
