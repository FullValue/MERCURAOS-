import { cache } from "react";
import { prisma } from "@/lib/db";
import { valeurAuJour, valeurAuJourParGroupe } from "@/lib/calcul";
import {
  CLE_FRAIS_LIVRAISON,
  CLE_FRAIS_LIVRAISON_TTC,
  CLE_LIVRAISON_NB_PIECES,
  CLE_TAUX_PERTE,
  CLE_TVA_RECUPERABLE,
} from "@/lib/calcul/cout";

export interface ValeurHistorisee {
  valeur: string;
  dateEffet: string; // ISO
}

export interface ComposantCourant {
  libelle: string;
  formatId: string;
  formatLibelle: string;
  coutUnitHT: string;
  optionnel: boolean;
  /** Quantité commandée au fournisseur sur la période ("" si non renseignée). */
  qteCommandee: string;
  /** Le montant saisi est TTC (ramené en HT dans les calculs). */
  tvaIncluse: boolean;
  /** Ligne « Coûts de façonnage » du format (mise en avant, description libre). */
  faconnage: boolean;
  description: string;
  historique: ValeurHistorisee[];
}

export interface FaconnageCourant {
  produitId: string;
  parfumNom: string;
  formatId: string;
  formatLibelle: string;
  coutFixeSerie: string;
  coutVarUnitHT: string;
  qteLotRef: number;
}

export interface FormatBase {
  id: string;
  libelle: string;
  volumeL: string;
}

export interface ParfumBase {
  id: string;
  nom: string;
  prixLiquideL: string;
}

export interface PrixLiquideCourant {
  produitId: string;
  formatId: string;
  formatLibelle: string;
  parfumId: string;
  parfumNom: string;
  prixLitreHT: string;
  /** Litres commandés au fournisseur sur la période ("" si non renseignés). */
  litresCommandes: string;
  /** Le montant saisi est TTC (ramené en HT dans les calculs). */
  tvaIncluse: boolean;
  historique: ValeurHistorisee[];
}

export interface CoutVariableLigne {
  id: string;
  libelle: string;
  montant: string;
  tvaIncluse: boolean;
  dateEffet: string; // ISO
}

export interface PeriodeCoutsInfo {
  id: string;
  libelle: string;
  dateEffet: string; // ISO
}

export interface EtatParametres {
  tauxPerte: string;
  tauxPerteHistorique: ValeurHistorisee[];
  /** Frais de livraison fournisseur (€/commande), "" si jamais renseignés. */
  fraisLivraison: string;
  fraisLivraisonHistorique: ValeurHistorisee[];
  /** Le montant de livraison saisi est TTC. */
  fraisLivraisonTtc: boolean;
  /** Nombre de pièces livrées par la commande ("" si non renseigné). */
  livraisonNbPieces: string;
  /** TVA récupérable (défaut oui) : non = les montants TTC comptent en entier. */
  tvaRecuperable: boolean;
  composants: ComposantCourant[];
  faconnages: FaconnageCourant[];
  prixLiquides: PrixLiquideCourant[];
  /** Coûts variables de commande fournisseur en vigueur à la date. */
  coutsVariables: CoutVariableLigne[];
  formats: FormatBase[];
  parfums: ParfumBase[];
  produits: { id: string; parfumId: string; parfumNom: string; formatId: string; formatLibelle: string }[];
}

/** Périodes de coûts (commandes fournisseurs), la plus récente en tête. */
export async function chargerPeriodes(): Promise<PeriodeCoutsInfo[]> {
  const periodes = await prisma.periodeCouts.findMany({
    orderBy: { dateEffet: "desc" },
  });
  return periodes.map((p) => ({
    id: p.id,
    libelle: p.libelle,
    dateEffet: p.dateEffet.toISOString(),
  }));
}

const chargerHistoriques = cache(async () => await Promise.all([
      prisma.parametre.findMany({ orderBy: { dateEffet: "desc" } }),
      prisma.composant.findMany({ orderBy: { dateEffet: "desc" }, include: { format: true } }),
      prisma.faconnage.findMany({ orderBy: { dateEffet: "desc" }, include: { format: true } }),
      prisma.format.findMany({ orderBy: { volumeL: "asc" } }),
      prisma.parfum.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      prisma.prixLiquide.findMany({ orderBy: { dateEffet: "desc" } }),
      prisma.coutVariable.findMany({ orderBy: { dateEffet: "desc" } }),
      prisma.produit.findMany({ where: { actif: true }, include: { parfum: true, format: true }, orderBy: [{ format: { volumeL: "desc" } }, { parfum: { nom: "asc" } }] }),
      prisma.prixLiquideReference.findMany({ orderBy: { dateEffet: "desc" } }),
      prisma.faconnageReference.findMany({ orderBy: { dateEffet: "desc" } }),
    ]));

/** Charge l'état courant des paramètres à la date, avec l'historique daté. */
export async function chargerParametres(
  date: Date = new Date(),
): Promise<EtatParametres> {
  const [parametres, composants, faconnages, formats, parfums, prixRows, coutsVarRows, produits, prixReferences, faconnagesReferences] = await chargerHistoriques();

  const pertes = parametres.filter((p) => p.cle === CLE_TAUX_PERTE);
  const perteCourante = valeurAuJour(
    pertes.map((p) => ({ valeur: p.valeur.toString(), dateEffet: p.dateEffet })),
    date,
  );

  const livraisons = parametres.filter((p) => p.cle === CLE_FRAIS_LIVRAISON);
  const livraisonCourante = valeurAuJour(
    livraisons.map((p) => ({ valeur: p.valeur.toString(), dateEffet: p.dateEffet })),
    date,
  );
  const livraisonTtcRow = valeurAuJour(
    parametres.filter((p) => p.cle === CLE_FRAIS_LIVRAISON_TTC),
    date,
  );
  const nbPiecesRow = valeurAuJour(
    parametres.filter((p) => p.cle === CLE_LIVRAISON_NB_PIECES),
    date,
  );
  const tvaRecupRow = valeurAuJour(
    parametres.filter((p) => p.cle === CLE_TVA_RECUPERABLE),
    date,
  );

  const prixLiquidesCourants: PrixLiquideCourant[] = produits.map((produit) => {
    const rows = prixReferences.filter((r) => r.produitId === produit.id);
    const anciens = prixRows.filter((r) => r.parfumId === produit.parfumId);
    const courant = valeurAuJour(rows, date) ?? valeurAuJour(anciens, date);
    return {
      produitId: produit.id,
      parfumId: produit.parfumId,
      parfumNom: produit.parfum.nom,
      formatId: produit.formatId,
      formatLibelle: produit.format.libelle,
      prixLitreHT: courant?.prixLitreHT.toString() ?? (produit.parfum.prixLiquideL.gt(0) ? produit.parfum.prixLiquideL.toString() : ""),
      litresCommandes: courant?.litresCommandes?.toString() ?? "",
      tvaIncluse: courant?.tvaIncluse ?? false,
      historique: [...rows, ...anciens].map((r) => ({
        valeur: r.prixLitreHT.toString(),
        dateEffet: r.dateEffet.toISOString(),
      })),
    };
  });

  const composantsCourants = valeurAuJourParGroupe(
    composants.map((c) => ({
      libelle: c.libelle,
      formatId: c.formatId,
      formatLibelle: c.format.libelle,
      coutUnitHT: c.coutUnitHT.toString(),
      optionnel: c.optionnel,
      qteCommandee: c.qteCommandee === null ? "" : String(c.qteCommandee),
      tvaIncluse: c.tvaIncluse,
      faconnage: c.faconnage,
      description: c.description ?? "",
      dateEffet: c.dateEffet,
    })),
    date,
    (c) => `${c.formatId}|${c.libelle}`,
  ).map((c) => ({
    libelle: c.libelle,
    formatId: c.formatId,
    formatLibelle: c.formatLibelle,
    coutUnitHT: c.coutUnitHT,
    optionnel: c.optionnel,
    qteCommandee: c.qteCommandee,
    tvaIncluse: c.tvaIncluse,
    faconnage: c.faconnage,
    description: c.description,
    historique: composants
      .filter((h) => h.formatId === c.formatId && h.libelle === c.libelle)
      .map((h) => ({ valeur: h.coutUnitHT.toString(), dateEffet: h.dateEffet.toISOString() })),
  }));

  const faconnagesCourants: FaconnageCourant[] = produits.flatMap((produit) => {
    const courant = valeurAuJour(faconnagesReferences.filter((f) => f.produitId === produit.id), date)
      ?? valeurAuJour(faconnages.filter((f) => f.formatId === produit.formatId), date);
    return courant ? [{
      produitId: produit.id,
      parfumNom: produit.parfum.nom,
      formatId: produit.formatId,
      formatLibelle: produit.format.libelle,
      coutFixeSerie: courant.coutFixeSerie.toString(),
      coutVarUnitHT: courant.coutVarUnitHT.toString(),
      qteLotRef: courant.qteLotRef,
    }] : [];
  });

  const coutsVariablesCourants = valeurAuJourParGroupe(
    coutsVarRows,
    date,
    (c) => c.libelle,
  ).map((c) => ({
    id: c.id,
    libelle: c.libelle,
    montant: c.montant.toString(),
    tvaIncluse: c.tvaIncluse,
    dateEffet: c.dateEffet.toISOString(),
  }));

  return {
    tauxPerte: perteCourante?.valeur ?? "0",
    tauxPerteHistorique: pertes.map((p) => ({
      valeur: p.valeur.toString(),
      dateEffet: p.dateEffet.toISOString(),
    })),
    fraisLivraison: livraisonCourante?.valeur ?? "",
    fraisLivraisonHistorique: livraisons.map((p) => ({
      valeur: p.valeur.toString(),
      dateEffet: p.dateEffet.toISOString(),
    })),
    fraisLivraisonTtc: livraisonTtcRow !== null && Number(livraisonTtcRow.valeur) >= 1,
    livraisonNbPieces:
      nbPiecesRow !== null && Number(nbPiecesRow.valeur) > 0
        ? String(Math.round(Number(nbPiecesRow.valeur)))
        : "",
    tvaRecuperable: tvaRecupRow === null || Number(tvaRecupRow.valeur) >= 1,
    prixLiquides: prixLiquidesCourants,
    coutsVariables: coutsVariablesCourants,
    composants: composantsCourants,
    faconnages: faconnagesCourants,
    formats: formats.map((f) => ({ id: f.id, libelle: f.libelle, volumeL: f.volumeL.toString() })),
    parfums: parfums.map((p) => ({ id: p.id, nom: p.nom, prixLiquideL: p.prixLiquideL.toString() })),
    produits: produits.map((p) => ({ id: p.id, parfumId: p.parfumId, parfumNom: p.parfum.nom, formatId: p.formatId, formatLibelle: p.format.libelle })),
  };
}
