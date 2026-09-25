import { cache } from "react";
import { prisma, type TransactionMercura } from "@/lib/db";
import { decompositionCout, Decimal, valeurAuJour } from "@/lib/calcul";
import type {
  DecompositionCout,
  OptionsCout,
  ProduitContexte,
} from "@/lib/calcul/types";

export interface ProduitEnrichi {
  produitId: string;
  sku: string;
  skuShopify: string | null;
  parfumId: string;
  parfumNom: string;
  formatId: string;
  formatLibelle: string;
  contexte: ProduitContexte;
}

/** Garde l'historique commun jusqu'à la première saisie propre à la référence. */
function historiqueParReference<T extends { dateEffet: Date }, U extends { dateEffet: Date }>(commun: T[], propre: U[]): (T | U)[] {
  if (propre.length === 0) return commun;
  const premiere = propre.reduce((date, ligne) => ligne.dateEffet < date ? ligne.dateEffet : date, propre[0]!.dateEffet);
  return [...commun.filter((ligne) => ligne.dateEffet < premiere), ...propre];
}

/** Charge les produits avec leur historique de coûts, sans Decimal Prisma. */
export const chargerProduitsEnrichis = cache(async function chargerProduitsEnrichis(
  inclureInactifs = false, db: TransactionMercura = prisma,
): Promise<ProduitEnrichi[]> {
  const [produits, composants, faconnages, parametres, prixLiquides, coutsVariables, prixReferences, faconnagesReferences] =
    await Promise.all([
      db.produit.findMany({
        where: inclureInactifs ? {} : { actif: true },
        include: { parfum: true, format: true },
        orderBy: [{ parfum: { nom: "asc" } }, { format: { libelle: "asc" } }],
      }),
      db.composant.findMany(),
      db.faconnage.findMany(),
      db.parametre.findMany(),
      db.prixLiquide.findMany(),
      db.coutVariable.findMany(),
      db.prixLiquideReference.findMany(),
      db.faconnageReference.findMany(),
    ]);

  const parametresEngine = parametres.map((p) => ({
    cle: p.cle,
    valeur: p.valeur.toString(),
    dateEffet: p.dateEffet,
  }));

  const coutsVariablesEngine = coutsVariables.map((c) => ({
    libelle: c.libelle,
    montant: c.montant.toString(),
    tvaIncluse: c.tvaIncluse,
    dateEffet: c.dateEffet,
  }));

  return produits.map((produit) => {
    const contexte: ProduitContexte = {
      volumeL: produit.format.volumeL.toString(),
      prixLiquideL: produit.parfum.prixLiquideL.toString(),
      prixLiquides: historiqueParReference(
        prixLiquides.filter((x) => x.parfumId === produit.parfumId),
        prixReferences.filter((x) => x.produitId === produit.id),
      )
        .map((x) => ({
          prixLitreHT: x.prixLitreHT.toString(),
          tvaIncluse: x.tvaIncluse,
          dateEffet: x.dateEffet,
        })),
      parametres: parametresEngine,
      coutsVariables: coutsVariablesEngine,
      composants: composants
        .filter((c) => c.formatId === produit.formatId)
        .map((c) => ({
          libelle: c.libelle,
          coutUnitHT: c.coutUnitHT.toString(),
          optionnel: c.optionnel,
          tvaIncluse: c.tvaIncluse,
          faconnage: c.faconnage,
          dateEffet: c.dateEffet,
        })),
      faconnages: historiqueParReference(
        faconnages.filter((f) => f.formatId === produit.formatId),
        faconnagesReferences.filter((f) => f.produitId === produit.id),
      )
        .map((f) => ({
          coutFixeSerie: f.coutFixeSerie.toString(),
          coutVarUnitHT: f.coutVarUnitHT.toString(),
          qteLotRef: f.qteLotRef,
          dateEffet: f.dateEffet,
        })),
    };
    return {
      produitId: produit.id,
      sku: produit.sku,
      skuShopify: produit.skuShopify,
      parfumId: produit.parfumId,
      parfumNom: produit.parfum.nom,
      formatId: produit.formatId,
      formatLibelle: produit.format.libelle,
      contexte,
    };
  });
});

export interface LigneCatalogue extends ProduitEnrichi {
  decomposition: DecompositionCout;
  /** Un zéro technique sans historique ne constitue pas un prix du liquide. */
  prixLiquideRenseigne: boolean;
  /**
   * Prix de cession de référence pour le filet de charge : prix de grille
   * courant le plus élevé du produit (proxy de prix catalogue). `null` si aucune
   * grille. Décision à confirmer (le catalogue n'est lié à aucun client).
   */
  prixReference: Decimal | null;
}

/**
 * Prix de cession de référence par produit à la date : pour chaque client, le
 * prix de grille applicable (via valeurAuJour), puis le maximum entre clients.
 */
async function prixReferenceParProduit(
  date: Date,
): Promise<Map<string, Decimal>> {
  const grilles = await prisma.grillePrix.findMany();
  // Regroupe par (produit, client) pour appliquer valeurAuJour par grille client.
  const parProduitClient = new Map<
    string,
    { prixCessionHT: Decimal; dateEffet: Date }[]
  >();
  for (const g of grilles) {
    const cle = `${g.produitId}|${g.clientId}`;
    const liste = parProduitClient.get(cle) ?? [];
    liste.push({ prixCessionHT: new Decimal(g.prixCessionHT.toString()), dateEffet: g.dateEffet });
    parProduitClient.set(cle, liste);
  }
  const parProduit = new Map<string, Decimal>();
  for (const [cle, liste] of parProduitClient) {
    const produitId = cle.split("|")[0]!;
    const courant = valeurAuJour(liste, date);
    if (!courant) continue;
    const actuel = parProduit.get(produitId);
    if (!actuel || courant.prixCessionHT.gt(actuel)) {
      parProduit.set(produitId, courant.prixCessionHT);
    }
  }
  return parProduit;
}

/** Catalogue : chaque produit avec sa décomposition de coût à la date. */
export async function chargerCatalogue(
  date: Date = new Date(),
  options: OptionsCout = {},
): Promise<LigneCatalogue[]> {
  const [produits, prixRef] = await Promise.all([
    chargerProduitsEnrichis(),
    prixReferenceParProduit(date),
  ]);
  return produits.map((p) => ({
    ...p,
    decomposition: decompositionCout(p.contexte, date, options),
    prixLiquideRenseigne: new Decimal(p.contexte.prixLiquideL).gt(0)
      || valeurAuJour(p.contexte.prixLiquides ?? [], date) !== null,
    prixReference: prixRef.get(p.produitId) ?? null,
  }));
}
