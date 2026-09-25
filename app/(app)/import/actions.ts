"use server";
import { erreurAction } from "@/lib/actions";

import { exigerUtilisateur } from "@/lib/auth";

import { z } from "zod";
import { ErreurMetier, revaliderApplication } from "@/lib/actions";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  litBooleen,
  litDate,
  litNombre,
  type ChoixDoublon,
  type LignePrevisualisee,
  type LigneProjetee,
  type Mapping,
  type TypeCible,
} from "@/lib/import/definitions";
import { calculerCoutsCommande } from "@/lib/donnees/couts";

const TYPES: TypeCible[] = ["composants", "grille_prix", "commandes"];

/** Dernier mapping appliqué pour ce type, proposé par défaut (§9.2). */
export async function chargerDernierMapping(
  typeCible: string,
): Promise<Mapping | null> {
  await exigerUtilisateur();
  if (!TYPES.includes(typeCible as TypeCible)) return null;
  const dernier = await prisma.import.findFirst({
    where: { typeCible, statut: "APPLIQUE" },
    orderBy: { createdAt: "desc" },
  });
  return (dernier?.mapping as Mapping) ?? null;
}

// ---------------------------------------------------------------------------
// Prévisualisation (§9.3)
// ---------------------------------------------------------------------------

const schemaPrevisualisation = z.object({
  typeCible: z.enum(["composants", "grille_prix", "commandes"]),
  lignes: z.array(z.record(z.string())),
});

export async function previsualiserImport(entree: {
  typeCible: string;
  lignes: LigneProjetee[];
}): Promise<{ ok: boolean; lignes: LignePrevisualisee[]; message?: string }> {
  await exigerUtilisateur();
  const parsed = schemaPrevisualisation.safeParse(entree);
  if (!parsed.success) return { ok: false, lignes: [], message: "Données invalides." };
  const { typeCible, lignes } = parsed.data;

  const [formats, clients, produits] = await Promise.all([
    prisma.format.findMany(),
    prisma.client.findMany(),
    prisma.produit.findMany(),
  ]);
  const formatParLibelle = new Map(formats.map((f) => [f.libelle.toLowerCase(), f]));
  const clientParNom = new Map(clients.map((c) => [c.nom.toLowerCase(), c]));
  const produitParSku = new Map(produits.map((p) => [p.sku.toLowerCase(), p]));

  const resultat: LignePrevisualisee[] = [];

  if (typeCible === "composants") {
    const existants = await prisma.composant.findMany();
    for (const [index, v] of lignes.entries()) {
      const format = formatParLibelle.get((v.format ?? "").trim().toLowerCase());
      const cout = litNombre(v.coutUnitHT);
      if (!format) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Format inconnu : « ${v.format ?? ""} »` });
      } else if (!v.libelle?.trim()) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: "Libellé manquant" });
      } else if (cout === null) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Coût invalide : « ${v.coutUnitHT ?? ""} »` });
      } else if (
        existants.some(
          (e) => e.formatId === format.id && e.libelle.toLowerCase() === v.libelle!.trim().toLowerCase(),
        )
      ) {
        resultat.push({ index, valeurs: v, statut: "doublon", motif: "Composant déjà connu (une mise à jour crée une nouvelle valeur datée)" });
      } else {
        resultat.push({ index, valeurs: v, statut: "ok" });
      }
    }
  } else if (typeCible === "grille_prix") {
    const existantes = await prisma.grillePrix.findMany();
    for (const [index, v] of lignes.entries()) {
      const client = clientParNom.get((v.client ?? "").trim().toLowerCase());
      const produit = produitParSku.get((v.sku ?? "").trim().toLowerCase());
      const prix = litNombre(v.prixCessionHT);
      if (!client) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Client inconnu : « ${v.client ?? ""} »` });
      } else if (!produit) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `SKU inconnu : « ${v.sku ?? ""} »` });
      } else if (prix === null) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Prix invalide : « ${v.prixCessionHT ?? ""} »` });
      } else if (existantes.some((g) => g.clientId === client.id && g.produitId === produit.id)) {
        resultat.push({ index, valeurs: v, statut: "doublon", motif: "Prix déjà défini (une mise à jour crée un nouveau prix daté)" });
      } else {
        resultat.push({ index, valeurs: v, statut: "ok" });
      }
    }
  } else {
    const existantes = await prisma.commande.findMany();
    const refExistantes = new Set(existantes.map((c) => c.reference.toLowerCase()));
    for (const [index, v] of lignes.entries()) {
      const client = clientParNom.get((v.client ?? "").trim().toLowerCase());
      const produit = produitParSku.get((v.sku ?? "").trim().toLowerCase());
      const date = litDate(v.date);
      const qte = litNombre(v.qte);
      const pu = litNombre(v.puHT);
      if (!v.reference?.trim()) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: "Référence manquante" });
      } else if (!client) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Client inconnu : « ${v.client ?? ""} »` });
      } else if (!produit) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `SKU inconnu : « ${v.sku ?? ""} »` });
      } else if (!date) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Date invalide : « ${v.date ?? ""} »` });
      } else if (qte === null || Number(qte) <= 0 || !Number.isInteger(Number(qte))) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Quantité invalide : « ${v.qte ?? ""} »` });
      } else if (pu === null) {
        resultat.push({ index, valeurs: v, statut: "erreur", motif: `Prix invalide : « ${v.puHT ?? ""} »` });
      } else if (refExistantes.has(v.reference.trim().toLowerCase())) {
        resultat.push({ index, valeurs: v, statut: "doublon", motif: "Référence déjà existante" });
      } else {
        resultat.push({ index, valeurs: v, statut: "ok" });
      }
    }
  }

  return { ok: true, lignes: resultat };
}

// ---------------------------------------------------------------------------
// Application (§9.4) — snapshot pour annulation
// ---------------------------------------------------------------------------

interface Snapshot {
  composantsCrees?: string[];
  grillesCreees?: string[];
  commandesCreees?: string[];
}

const schemaApplication = z.object({
  typeCible: z.enum(["composants", "grille_prix", "commandes"]),
  nomFichier: z.string().min(1),
  mapping: z.record(z.string()),
  lignes: z.array(z.record(z.string())),
  choix: z.record(z.enum(["creer", "maj", "ignorer"])),
});

export async function appliquerImport(entree: {
  typeCible: string;
  nomFichier: string;
  mapping: Mapping;
  lignes: LigneProjetee[];
  /** index de ligne → choix pour les doublons et lignes en erreur ignorées. */
  choix: Record<string, ChoixDoublon>;
}): Promise<{ ok: boolean; message: string; lignesOk?: number }> {
  await exigerUtilisateur();
  try {
  const parsed = schemaApplication.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Données invalides." };
  const { typeCible, nomFichier, mapping, lignes, choix } = parsed.data;

  // Re-validation serveur complète : la prévisualisation fait foi.
  const prev = await previsualiserImport({ typeCible, lignes });
  if (!prev.ok) return { ok: false, message: "Prévisualisation impossible." };

  const erreursNonTraitees = prev.lignes.filter(
    (l) => l.statut === "erreur" && choix[String(l.index)] !== "ignorer",
  );
  if (erreursNonTraitees.length > 0) {
    return {
      ok: false,
      message: `${erreursNonTraitees.length} ligne(s) en erreur non traitée(s).`,
    };
  }

  const resultat = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260922, 1)`;
  const maintenant = new Date();
  const snapshot: Snapshot = {};
  let lignesOk = 0;
  let lignesIgnorees = 0;

  const aTraiter = prev.lignes.filter((l) => {
    if (l.statut === "erreur") { lignesIgnorees++; return false; }
    if (l.statut === "doublon") {
      const c = choix[String(l.index)];
      if (!c || c === "ignorer") { lignesIgnorees++; return false; }
    }
    return true;
  });

  if (typeCible === "composants") {
    const formats = await tx.format.findMany();
    const formatParLibelle = new Map(formats.map((f) => [f.libelle.toLowerCase(), f]));
    const crees: string[] = [];
    {
      for (const l of aTraiter) {
        const format = formatParLibelle.get(l.valeurs.format!.trim().toLowerCase())!;
        const row = await tx.composant.create({
          data: {
            libelle: l.valeurs.libelle!.trim(),
            formatId: format.id,
            coutUnitHT: litNombre(l.valeurs.coutUnitHT)!,
            optionnel: litBooleen(l.valeurs.optionnel),
            dateEffet: maintenant,
          },
        });
        crees.push(row.id);
        lignesOk++;
      }
    }
    snapshot.composantsCrees = crees;
  } else if (typeCible === "grille_prix") {
    const [clients, produits] = await Promise.all([
      tx.client.findMany(),
      tx.produit.findMany(),
    ]);
    const clientParNom = new Map(clients.map((c) => [c.nom.toLowerCase(), c]));
    const produitParSku = new Map(produits.map((p) => [p.sku.toLowerCase(), p]));
    const crees: string[] = [];
    {
      for (const l of aTraiter) {
        const client = clientParNom.get(l.valeurs.client!.trim().toLowerCase())!;
        const produit = produitParSku.get(l.valeurs.sku!.trim().toLowerCase())!;
        const row = await tx.grillePrix.create({
          data: {
            clientId: client.id,
            produitId: produit.id,
            prixCessionHT: litNombre(l.valeurs.prixCessionHT)!,
            dateEffet: maintenant,
          },
        });
        crees.push(row.id);
        lignesOk++;
      }
    }
    snapshot.grillesCreees = crees;
  } else {
    // Commandes : regroupées par référence, créées en BROUILLON avec coûts calculés.
    const [clients, produits] = await Promise.all([
      tx.client.findMany(),
      tx.produit.findMany(),
    ]);
    const clientParNom = new Map(clients.map((c) => [c.nom.toLowerCase(), c]));
    const produitParSku = new Map(produits.map((p) => [p.sku.toLowerCase(), p]));

    const parReference = new Map<string, typeof aTraiter>();
    for (const l of aTraiter) {
      const ref = l.valeurs.reference!.trim();
      const liste = parReference.get(ref) ?? [];
      liste.push(l);
      parReference.set(ref, liste);
    }

    const crees: string[] = [];
    for (const [reference, lignesRef] of parReference) {
      const premiere = lignesRef[0]!;
      if (lignesRef.some((l) => l.valeurs.client?.trim().toLowerCase() !== premiere.valeurs.client?.trim().toLowerCase() || litDate(l.valeurs.date)?.getTime() !== litDate(premiere.valeurs.date)?.getTime())) {
        throw new ErreurMetier(`La référence ${reference} contient plusieurs clients ou dates.`);
      }
      const client = clientParNom.get(premiere.valeurs.client!.trim().toLowerCase())!;
      const date = litDate(premiere.valeurs.date)!;
      const lignesCommande = lignesRef.map((l) => ({
        produitId: produitParSku.get(l.valeurs.sku!.trim().toLowerCase())!.id,
        qte: Number(litNombre(l.valeurs.qte)!),
        puHT: litNombre(l.valeurs.puHT)!,
        offert: litBooleen(l.valeurs.offert),
      }));
      const couts = await calculerCoutsCommande(
        lignesCommande.map((l) => ({ produitId: l.produitId, qte: l.qte })),
        date, tx,
      );
      // Doublon « créer » : suffixe pour ne pas percuter la référence existante.
      const existe = await tx.commande.findUnique({ where: { reference } });
      if (existe && lignesRef.some((l) => choix[String(l.index)] === "maj")) throw new ErreurMetier("Pour modifier une commande existante, utilisez sa fiche. L’import permet de créer une copie ou d’ignorer le doublon.");
      const refFinale = existe ? `${reference}-import-${crypto.randomUUID().slice(0, 8)}` : reference;
      const cmd = await tx.commande.create({
        data: {
          reference: refFinale,
          clientId: client.id,
          date,
          statut: "BROUILLON",
          lignes: {
            create: lignesCommande.map((l) => ({
              produitId: l.produitId,
              qte: l.qte,
              puHT: l.offert ? "0" : l.puHT,
              offert: l.offert,
              coutUnitFige: couts.get(l.produitId)!,
            })),
          },
        },
      });
      crees.push(cmd.id);
      lignesOk += lignesRef.length;
    }
    snapshot.commandesCreees = crees;
  }

  await tx.import.create({
    data: {
      nomFichier,
      typeCible,
      mapping: mapping as Prisma.InputJsonValue,
      statut: "APPLIQUE",
      lignesOk,
      lignesErreur: lignesIgnorees,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });

    return { ok: true, message: `${lignesOk} ligne(s) importée(s), ${lignesIgnorees} ignorée(s).`, lignesOk };
  }, { timeout: 60000, maxWait: 10000 });

  revaliderApplication();
  return resultat;

  } catch (e) { return erreurAction(e); }
}

/** Annule un import appliqué en restaurant l'état antérieur (§9.4). */
export async function annulerImport(
  importId: string,
): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
  const imp = await prisma.import.findUnique({ where: { id: importId } });
  if (!imp) return { ok: false, message: "Import introuvable." };
  if (imp.statut !== "APPLIQUE") {
    return { ok: false, message: "Seul un import appliqué peut être annulé." };
  }
  const snapshot = (imp.snapshot ?? {}) as Snapshot;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260922, 1)`;
    if (snapshot.commandesCreees?.length && await tx.commande.count({ where: { id: { in: snapshot.commandesCreees }, statut: { not: "BROUILLON" } } })) {
      throw new ErreurMetier("Des commandes de cet import ont été confirmées. Rouvrez-les en brouillon avant d’annuler l’import.");
    }
    if (snapshot.composantsCrees?.length) {
      await tx.composant.deleteMany({ where: { id: { in: snapshot.composantsCrees } } });
    }
    if (snapshot.grillesCreees?.length) {
      await tx.grillePrix.deleteMany({ where: { id: { in: snapshot.grillesCreees } } });
    }
    if (snapshot.commandesCreees?.length) {
      await tx.commande.deleteMany({ where: { id: { in: snapshot.commandesCreees } } });
    }
    await tx.import.update({ where: { id: importId }, data: { statut: "ANNULE" } });
  });

  revaliderApplication();
  return { ok: true, message: "Import annulé, état antérieur restauré." };

  } catch (e) { return erreurAction(e); }
}
