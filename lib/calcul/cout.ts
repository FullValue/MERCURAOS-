import { Decimal, d } from "./decimal";
import type {
  DecompositionCout,
  OptionsCout,
  ProduitContexte,
} from "./types";
import { valeurAuJour, valeurAuJourParGroupe } from "./valeurAuJour";

export const CLE_TAUX_PERTE = "taux_perte";
export const CLE_FRAIS_LIVRAISON = "frais_livraison";
/** Nombre de pièces livrées par la commande fournisseur (base de répartition de la livraison). */
export const CLE_LIVRAISON_NB_PIECES = "livraison_nb_pieces";
/** 1 si le montant de livraison saisi est TTC, 0 sinon. */
export const CLE_FRAIS_LIVRAISON_TTC = "frais_livraison_ttc";

/** Taux de TVA français appliqué pour ramener un montant TTC en HT. */
export const TAUX_TVA = "0.20";
/** 0 = TVA non récupérable (franchise) : les montants TTC comptent en entier. */
export const CLE_TVA_RECUPERABLE = "tva_recuperable";

/** Montant HT : divise par (1 + TVA) si le montant saisi est TTC. */
export function horsTaxe(montant: import("./decimal").Numeric, tvaIncluse?: boolean): Decimal {
  return tvaIncluse ? d(montant).div(d(TAUX_TVA).plus(1)) : d(montant);
}

/**
 * TVA récupérable à la date (défaut : oui). En franchise de TVA (non), la TVA
 * payée est un vrai coût : les montants TTC ne sont pas ramenés en HT.
 */
export function tvaRecuperable(ctx: ProduitContexte, date: Date): boolean {
  const rows = ctx.parametres.filter((p) => p.cle === CLE_TVA_RECUPERABLE);
  const row = valeurAuJour(rows, date);
  return row === null ? true : d(row.valeur).gte(1);
}

/** Taux de perte applicable à la date (0 si aucun paramètre). */
export function tauxPerte(ctx: ProduitContexte, date: Date): Decimal {
  const pertes = ctx.parametres.filter((p) => p.cle === CLE_TAUX_PERTE);
  const row = valeurAuJour(pertes, date);
  return row === null ? new Decimal(0) : d(row.valeur);
}

/**
 * Prix du liquide applicable à la date : historique `prixLiquides` en priorité
 * (résolution valeurAuJour), sinon repli sur `prixLiquideL`.
 */
export function prixLiquideAuJour(ctx: ProduitContexte, date: Date): Decimal {
  if (ctx.prixLiquides && ctx.prixLiquides.length > 0) {
    const row = valeurAuJour(ctx.prixLiquides, date);
    if (row !== null)
      return horsTaxe(row.prixLitreHT, row.tvaIncluse && tvaRecuperable(ctx, date));
  }
  return d(ctx.prixLiquideL);
}

/**
 * coûtLiquide = volumeL × prixLiquideL × (1 + tauxPerte)  (§5.1)
 */
export function coutLiquide(ctx: ProduitContexte, date: Date): Decimal {
  const perte = tauxPerte(ctx, date);
  return d(ctx.volumeL).mul(prixLiquideAuJour(ctx, date)).mul(perte.plus(1));
}

/**
 * Frais de livraison fournisseur applicables à la date (paramètre facultatif
 * `frais_livraison`, € HT par commande fournisseur ; 0 si absent).
 */
export function fraisLivraison(ctx: ProduitContexte, date: Date): Decimal {
  const rows = ctx.parametres.filter((p) => p.cle === CLE_FRAIS_LIVRAISON);
  const row = valeurAuJour(rows, date);
  if (row === null) return new Decimal(0);
  const ttcRows = ctx.parametres.filter((p) => p.cle === CLE_FRAIS_LIVRAISON_TTC);
  const ttc = valeurAuJour(ttcRows, date);
  return horsTaxe(
    row.valeur,
    ttc !== null && d(ttc.valeur).gte(1) && tvaRecuperable(ctx, date),
  );
}

/**
 * Somme HT des coûts variables de commande fournisseur applicables à la date
 * (douane, transitaire… — résolution valeurAuJour par libellé).
 */
export function coutsVariablesCommande(ctx: ProduitContexte, date: Date): Decimal {
  if (!ctx.coutsVariables || ctx.coutsVariables.length === 0) return new Decimal(0);
  const applicables = valeurAuJourParGroupe(ctx.coutsVariables, date, (c) => c.libelle);
  const recup = tvaRecuperable(ctx, date);
  return applicables.reduce<Decimal>(
    (acc, c) => acc.plus(horsTaxe(c.montant, c.tvaIncluse && recup)),
    new Decimal(0),
  );
}

/**
 * Base de répartition de la livraison : le nombre de pièces livrées par la
 * commande fournisseur (paramètre `livraison_nb_pieces`), sinon la quantité
 * de lot du façonnage en repli.
 */
export function livraisonNbPieces(ctx: ProduitContexte, date: Date): Decimal | null {
  const rows = ctx.parametres.filter((p) => p.cle === CLE_LIVRAISON_NB_PIECES);
  const row = valeurAuJour(rows, date);
  if (row === null) return null;
  const n = d(row.valeur);
  return n.gt(0) ? n : null;
}

/**
 * coûtConditionnement = Σ composants du format à cette date
 * (les optionnels ne sont inclus que si `avecOptionnels`).  (§5.1)
 *
 * La résolution à la date se fait par libellé via `valeurAuJour`.
 */
export function coutConditionnement(
  ctx: ProduitContexte,
  date: Date,
  avecOptionnels: boolean,
): Decimal {
  const applicables = valeurAuJourParGroupe(
    ctx.composants,
    date,
    (c) => c.libelle,
  );
  const recup = tvaRecuperable(ctx, date);
  return applicables.reduce<Decimal>((acc, c) => {
    if (c.optionnel && !avecOptionnels) return acc;
    if (c.faconnage) return acc; // compté dans le poste façonnage
    return acc.plus(horsTaxe(c.coutUnitHT, c.tvaIncluse && recup));
  }, new Decimal(0));
}

/**
 * Coûts de façonnage portés par les lignes de composants marquées `faconnage`
 * (blistage, mise en bouteille, sertissage…), € HT par flacon à la date.
 */
export function coutFaconnageComposants(ctx: ProduitContexte, date: Date): Decimal {
  const applicables = valeurAuJourParGroupe(ctx.composants, date, (c) => c.libelle);
  const recup = tvaRecuperable(ctx, date);
  return applicables.reduce<Decimal>((acc, c) => {
    if (!c.faconnage || c.optionnel) return acc;
    return acc.plus(horsTaxe(c.coutUnitHT, c.tvaIncluse && recup));
  }, new Decimal(0));
}

/**
 * coûtFaçonnage = coutFixeSerie / qteLot + coutVarUnitHT  (§5.1)
 *
 * `qteLot` par défaut = `qteLotRef` du façonnage applicable.
 * Retourne 0 si aucun façonnage n'est applicable à la date.
 */
export function coutFaconnage(
  ctx: ProduitContexte,
  date: Date,
  qteLot?: import("./decimal").Numeric,
): Decimal {
  const fac = valeurAuJour(ctx.faconnages, date);
  if (fac === null) return new Decimal(0);
  const lot = qteLot === undefined ? d(fac.qteLotRef) : d(qteLot);
  if (lot.lte(0)) {
    throw new Error("qteLot doit être strictement positif pour amortir le façonnage");
  }
  return d(fac.coutFixeSerie).div(lot).plus(d(fac.coutVarUnitHT));
}

/**
 * Décomposition complète du coût de revient d'un produit à une date donnée.
 * Aucun arrondi intermédiaire (§5.2).
 */
export function decompositionCout(
  ctx: ProduitContexte,
  date: Date,
  options: OptionsCout = {},
): DecompositionCout {
  const avecOptionnels = options.avecOptionnels ?? false;

  const fac = valeurAuJour(ctx.faconnages, date);
  const qteLot =
    options.qteLot !== undefined
      ? d(options.qteLot)
      : fac !== null
        ? d(fac.qteLotRef)
        : new Decimal(0);

  const liquide = coutLiquide(ctx, date);
  const conditionnement = coutConditionnement(ctx, date, avecOptionnels);
  // Façonnage = coût de série (table Faconnage, éventuellement neutralisé)
  // + lignes de composants marquées « Coûts de façonnage ».
  const faconnage = (fac === null ? new Decimal(0) : coutFaconnage(ctx, date, qteLot)).plus(
    coutFaconnageComposants(ctx, date),
  );
  // Frais de commande fournisseur (livraison + coûts variables : douane,
  // transitaire…) : répartis sur le nombre de pièces livrées (paramètre
  // dédié), sinon sur la quantité de lot en repli.
  const frais = fraisLivraison(ctx, date).plus(coutsVariablesCommande(ctx, date));
  const basePieces = livraisonNbPieces(ctx, date) ?? qteLot;
  const livraison =
    frais.lte(0) || basePieces.lte(0) ? new Decimal(0) : frais.div(basePieces);

  const matiereEtCond = liquide.plus(conditionnement);
  const complet = matiereEtCond.plus(faconnage).plus(livraison);

  return { liquide, conditionnement, faconnage, livraison, matiereEtCond, complet, qteLot };
}

/** Raccourci : coût complet seul. */
export function coutComplet(
  ctx: ProduitContexte,
  date: Date,
  options: OptionsCout = {},
): Decimal {
  return decompositionCout(ctx, date, options).complet;
}
