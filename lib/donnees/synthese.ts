import type { PeriodiciteCharge, RoleClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/calcul";
import { SEUIL_ECART_GAMME } from "@/lib/constantes";

export interface MargeProduit {
  produitId: string;
  parfumNom: string;
  formatLibelle: string;
  qte: number;
  caHT: Decimal;
  cout: Decimal;
  marge: Decimal;
  taux: Decimal | null;
  /** Écart du taux à la moyenne de gamme du format (points), null si non calculable. */
  ecartGamme: Decimal | null;
}

export interface MargeClient {
  clientId: string;
  nom: string;
  caHT: Decimal;
  marge: Decimal;
  taux: Decimal | null;
}

export interface PartRole {
  role: RoleClient;
  caHT: Decimal;
  part: Decimal;
}

export interface ChargeGlobaleLigne {
  id: string;
  libelle: string;
  montantHT: string;
  periodicite: PeriodiciteCharge;
  date: string; // ISO
  /** Montant imputé à la période (prorata jours pour mensuel/annuel). Chaîne : traverse la frontière client. */
  impute: string;
}

export interface Synthese {
  caHT: Decimal;
  coutRevient: Decimal;
  margeBrute: Decimal;
  chargesCommandes: Decimal;
  chargesFixes: Decimal;
  margeNette: Decimal;
  parProduit: MargeProduit[];
  parClient: MargeClient[];
  parRole: PartRole[];
  ecarts: MargeProduit[];
  chargesGlobales: ChargeGlobaleLigne[];
}

/** Priorité d'attribution du CA quand un client cumule plusieurs rôles. */
const PRIORITE_ROLE: RoleClient[] = [
  "DISTRIBUTEUR",
  "REVENDEUR",
  "CORNER",
  "D2C",
  "PROSPECT",
];

const MS_JOUR = 24 * 60 * 60 * 1000;

/**
 * Montant d'une charge imputé à la période [debut, fin].
 * PONCTUELLE : montant entier si sa date est dans la période.
 * MENSUELLE / ANNUELLE : taux journalier (×12/365 ou /365) × jours
 * d'intersection entre [date de la charge, fin] et la période.
 */
export function chargeImputee(
  charge: { montantHT: Decimal; periodicite: PeriodiciteCharge; date: Date },
  debut: Date,
  fin: Date,
): Decimal {
  if (charge.periodicite === "PONCTUELLE") {
    return charge.date >= debut && charge.date <= fin
      ? charge.montantHT
      : new Decimal(0);
  }
  const debutEffectif = charge.date > debut ? charge.date : debut;
  if (debutEffectif > fin) return new Decimal(0);
  const jours = Math.floor((fin.getTime() - debutEffectif.getTime()) / MS_JOUR) + 1;
  const tauxJournalier =
    charge.periodicite === "MENSUELLE"
      ? charge.montantHT.mul(12).div(365)
      : charge.montantHT.div(365);
  return tauxJournalier.mul(jours);
}

/**
 * Charges globales (coûts fixes) seules, avec le montant imputé à la période
 * [debut, fin] — par défaut l'année en cours jusqu'à aujourd'hui.
 */
export async function chargerChargesGlobales(
  debut?: Date,
  fin?: Date,
): Promise<ChargeGlobaleLigne[]> {
  const maintenant = new Date();
  const d0 = debut ?? new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));
  const d1 = fin ?? maintenant;
  const rows = await prisma.charge.findMany({
    where: { rattachement: "GLOBALE" },
    orderBy: { date: "desc" },
  });
  return rows.map((ch) => ({
    id: ch.id,
    libelle: ch.libelle,
    montantHT: ch.montantHT.toString(),
    periodicite: ch.periodicite,
    date: ch.date.toISOString(),
    impute: chargeImputee(
      {
        montantHT: new Decimal(ch.montantHT.toString()),
        periodicite: ch.periodicite,
        date: ch.date,
      },
      d0,
      d1,
    ).toString(),
  }));
}

/** Synthèse de la période (commandes confirmées et livrées uniquement). */
export async function chargerSynthese(debut: Date, fin: Date): Promise<Synthese> {
  const [commandes, chargesGlobalesRows] = await Promise.all([
    prisma.commande.findMany({
      where: {
        statut: { in: ["CONFIRMEE", "LIVREE"] },
        date: { gte: debut, lte: fin },
      },
      include: {
        client: { include: { roles: true } },
        lignes: { include: { produit: { include: { parfum: true, format: true } } } },
        charges: true,
      },
    }),
    prisma.charge.findMany({
      where: { rattachement: "GLOBALE" },
      orderBy: { date: "desc" },
    }),
  ]);

  let caHT = new Decimal(0);
  let coutRevient = new Decimal(0);
  let chargesCommandes = new Decimal(0);

  const parProduitMap = new Map<string, MargeProduit>();
  const parClientMap = new Map<string, MargeClient>();
  const parRoleMap = new Map<RoleClient, Decimal>();

  for (const cmd of commandes) {
    let caCmd = new Decimal(0);
    for (const l of cmd.lignes) {
      const cout = new Decimal(l.coutUnitFige.toString()).mul(l.qte);
      const ca = l.offert ? new Decimal(0) : new Decimal(l.puHT.toString()).mul(l.qte);
      caHT = caHT.plus(ca);
      caCmd = caCmd.plus(ca);
      coutRevient = coutRevient.plus(cout);

      const p = parProduitMap.get(l.produitId) ?? {
        produitId: l.produitId,
        parfumNom: l.produit.parfum.nom,
        formatLibelle: l.produit.format.libelle,
        qte: 0,
        caHT: new Decimal(0),
        cout: new Decimal(0),
        marge: new Decimal(0),
        taux: null,
        ecartGamme: null,
      };
      p.qte += l.qte;
      p.caHT = p.caHT.plus(ca);
      p.cout = p.cout.plus(cout);
      parProduitMap.set(l.produitId, p);

      const c = parClientMap.get(cmd.clientId) ?? {
        clientId: cmd.clientId,
        nom: cmd.client.nom,
        caHT: new Decimal(0),
        marge: new Decimal(0),
        taux: null,
      };
      c.caHT = c.caHT.plus(ca);
      c.marge = c.marge.plus(ca.minus(cout));
      parClientMap.set(cmd.clientId, c);
    }
    for (const ch of cmd.charges) {
      chargesCommandes = chargesCommandes.plus(ch.montantHT.toString());
    }
    // Attribution du CA au rôle prioritaire du client.
    const roles = cmd.client.roles.map((r) => r.role);
    const role = PRIORITE_ROLE.find((r) => roles.includes(r)) ?? "PROSPECT";
    parRoleMap.set(role, (parRoleMap.get(role) ?? new Decimal(0)).plus(caCmd));
  }

  // Taux et écarts par produit.
  const parProduit = [...parProduitMap.values()].map((p) => ({
    ...p,
    marge: p.caHT.minus(p.cout),
    taux: p.caHT.isZero() ? null : p.caHT.minus(p.cout).div(p.caHT),
  }));
  // Moyenne de gamme (repère) : moyenne des taux réalisés des produits du format.
  const parFormat = new Map<string, Decimal[]>();
  for (const p of parProduit) {
    if (p.taux === null) continue;
    const liste = parFormat.get(p.formatLibelle) ?? [];
    liste.push(p.taux);
    parFormat.set(p.formatLibelle, liste);
  }
  for (const p of parProduit) {
    const taux = parFormat.get(p.formatLibelle);
    if (p.taux === null || !taux || taux.length < 2) continue;
    const moyenne = taux.reduce((a, b) => a.plus(b), new Decimal(0)).div(taux.length);
    p.ecartGamme = p.taux.minus(moyenne);
  }

  const parClient = [...parClientMap.values()].map((c) => ({
    ...c,
    taux: c.caHT.isZero() ? null : c.marge.div(c.caHT),
  }));

  const parRole: PartRole[] = [...parRoleMap.entries()].map(([role, ca]) => ({
    role,
    caHT: ca,
    part: caHT.isZero() ? new Decimal(0) : ca.div(caHT),
  }));

  const chargesGlobales: ChargeGlobaleLigne[] = chargesGlobalesRows.map((ch) => ({
    id: ch.id,
    libelle: ch.libelle,
    montantHT: ch.montantHT.toString(),
    periodicite: ch.periodicite,
    date: ch.date.toISOString(),
    impute: chargeImputee(
      {
        montantHT: new Decimal(ch.montantHT.toString()),
        periodicite: ch.periodicite,
        date: ch.date,
      },
      debut,
      fin,
    ).toString(),
  }));
  const chargesFixes = chargesGlobales.reduce(
    (acc, ch) => acc.plus(ch.impute),
    new Decimal(0),
  );

  const margeBrute = caHT.minus(coutRevient);

  return {
    caHT,
    coutRevient,
    margeBrute,
    chargesCommandes,
    chargesFixes,
    margeNette: margeBrute.minus(chargesCommandes).minus(chargesFixes),
    parProduit: parProduit.sort((a, b) => b.caHT.comparedTo(a.caHT)),
    parClient: parClient.sort((a, b) => b.caHT.comparedTo(a.caHT)),
    parRole: parRole.sort((a, b) => b.caHT.comparedTo(a.caHT)),
    ecarts: parProduit.filter(
      (p) => p.ecartGamme !== null && p.ecartGamme.abs().gt(SEUIL_ECART_GAMME),
    ),
    chargesGlobales,
  };
}
