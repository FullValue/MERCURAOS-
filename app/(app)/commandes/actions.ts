"use server";

import { z } from "zod";
import { exigerUtilisateur } from "@/lib/auth";
import { prisma, type TransactionMercura } from "@/lib/db";
import { calculerCoutsCommande } from "@/lib/donnees/couts";
import { decimalPositif, dateSaisie } from "@/lib/validation";
import { ErreurMetier, erreurAction, revaliderApplication } from "@/lib/actions";

const schemaCommande = z.object({
  commandeId: z.string().min(1).optional(),
  clientId: z.string().min(1, "Choisir un client"),
  date: dateSaisie,
  dateCouts: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
  lignes: z.array(z.object({
    produitId: z.string().min(1),
    qte: z.number().int().positive().max(1000000),
    puHT: decimalPositif,
    offert: z.boolean(),
  })).min(1, "Au moins une ligne").max(500),
  charges: z.array(z.object({
    libelle: z.string().trim().min(1, "Libellé de charge requis").max(200),
    montantHT: decimalPositif,
  })).max(200).default([]),
});
export type EntreeCommande = z.input<typeof schemaCommande>;

/** Une transaction et un verrou commun empêchent confirmation/édition concurrentes. */
async function modifier<T>(fn: (tx: TransactionMercura) => Promise<T>) {
  const resultat = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260922, 1)`;
    return fn(tx);
  }, { maxWait: 10000, timeout: 30000 });
  revaliderApplication();
  return resultat;
}

async function exigerCommande(tx: TransactionMercura, id: string) {
  const commande = await tx.commande.findUnique({ where: { id }, include: { lignes: true } });
  if (!commande) throw new ErreurMetier("Commande introuvable.");
  return commande;
}

export async function enregistrerCommande(entree: EntreeCommande): Promise<{ ok: boolean; message: string; id?: string }> {
  await exigerUtilisateur();
  const parsed = schemaCommande.safeParse(entree);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  try {
    return await modifier(async (tx) => {
      const { commandeId, clientId, date, dateCouts, notes, lignes, charges } = parsed.data;
      if (commandeId) {
        const commande = await exigerCommande(tx, commandeId);
        if (commande.statut !== "BROUILLON") throw new ErreurMetier("Rouvrez la commande en brouillon avant de la modifier.");
        if (commande.source === "SHOPIFY") throw new ErreurMetier("Modifiez cette commande dans Shopify puis synchronisez.");
      }
      const dateCommande = new Date(date);
      const couts = await calculerCoutsCommande(lignes, dateCouts ? new Date(dateCouts) : dateCommande, tx);
      const data = {
        clientId, date: dateCommande, dateCouts: dateCouts ? new Date(dateCouts) : null,
        notes: notes?.trim() || null,
        lignes: { create: lignes.map((l) => ({ ...l, puHT: l.offert ? "0" : l.puHT, coutUnitFige: couts.get(l.produitId)! })) },
        charges: { create: charges.map((c) => ({ ...c, rattachement: "COMMANDE" as const, date: dateCommande })) },
      };
      if (commandeId) {
        await tx.ligneCommande.deleteMany({ where: { commandeId } });
        await tx.charge.deleteMany({ where: { commandeId } });
        await tx.commande.update({ where: { id: commandeId }, data });
        return { ok: true, message: "Brouillon enregistré.", id: commandeId };
      }
      // Max de la séquence réelle : supprimer une commande ne réutilise pas un numéro intermédiaire.
      const refs = await tx.commande.findMany({ where: { reference: { startsWith: "C-" } }, select: { reference: true } });
      const numero = refs.reduce((max, c) => /^C-\d+$/.test(c.reference) ? Math.max(max, Number(c.reference.slice(2))) : max, 0) + 1;
      const reference = `C-${String(numero).padStart(4, "0")}`;
      const creee = await tx.commande.create({ data: { ...data, reference } });
      return { ok: true, message: `Commande ${reference} créée.`, id: creee.id };
    });
  } catch (e) { return erreurAction(e); }
}

export async function confirmerCommande(commandeId: string): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
    return await modifier(async (tx) => {
      const commande = await exigerCommande(tx, commandeId);
      if (commande.statut !== "BROUILLON") throw new ErreurMetier("Seul un brouillon peut être confirmé.");
      if (!commande.lignes.length) throw new ErreurMetier("Ajoutez au moins une ligne avant de confirmer.");
      // Même date que l'aperçu et l'enregistrement, y compris pour une vente ancienne.
      const couts = await calculerCoutsCommande(commande.lignes, commande.dateCouts ?? commande.date, tx);
      for (const ligne of commande.lignes) await tx.ligneCommande.update({
        where: { id: ligne.id }, data: { coutUnitFige: couts.get(ligne.produitId)! },
      });
      await tx.commande.update({ where: { id: commandeId }, data: { statut: "CONFIRMEE", confirmeLe: new Date() } });
      return { ok: true, message: "Commande confirmée, coûts figés." };
    });
  } catch (e) { return erreurAction(e); }
}

export async function changerStatut(commandeId: string, statut: "LIVREE" | "ANNULEE"): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  if (statut !== "LIVREE" && statut !== "ANNULEE") return { ok: false, message: "Statut invalide." };
  try {
    return await modifier(async (tx) => {
      const commande = await exigerCommande(tx, commandeId);
      if (statut === "LIVREE" && commande.statut !== "CONFIRMEE") throw new ErreurMetier("Seule une commande confirmée peut être livrée.");
      await tx.commande.update({ where: { id: commandeId }, data: { statut } });
      return { ok: true, message: statut === "LIVREE" ? "Commande livrée." : "Commande annulée." };
    });
  } catch (e) { return erreurAction(e); }
}

export async function rouvrirCommande(commandeId: string): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
    return await modifier(async (tx) => {
      const commande = await exigerCommande(tx, commandeId);
      if (commande.source === "SHOPIFY") throw new ErreurMetier("Cette commande est gérée par Shopify.");
      await tx.commande.update({ where: { id: commandeId }, data: { statut: "BROUILLON", confirmeLe: null } });
      return { ok: true, message: "Commande rouverte. Modifiez-la puis confirmez-la à nouveau." };
    });
  } catch (e) { return erreurAction(e); }
}

export async function supprimerCommande(commandeId: string): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
    return await modifier(async (tx) => {
      const commande = await exigerCommande(tx, commandeId);
      if (commande.source === "SHOPIFY") throw new ErreurMetier("Annulez cette commande pour conserver le rapprochement Shopify.");
      await tx.commande.delete({ where: { id: commandeId } });
      return { ok: true, message: "Commande et charges rattachées supprimées." };
    });
  } catch (e) { return erreurAction(e); }
}
