import { Decimal, d, moyenne } from "./decimal";
import type { Numeric } from "./decimal";
import type { AnalyseMarge, ProduitContexte, OptionsCout } from "./types";
import { coutComplet, decompositionCout } from "./cout";

/**
 * Analyse de marge d'un produit sur un prix de cession (§5.1).
 *
 * marge       = prixCessionHT − coûtComplet
 * tauxMarque  = marge / prixCessionHT
 * coefficient = prixCessionHT / coûtComplet
 *
 * Les moyennes de gamme ne sont JAMAIS utilisées comme base de calcul de marge
 * (§5.2) : cette fonction prend toujours le coût réel du produit.
 */
export function analyseMarge(
  prixCessionHT: Numeric,
  ctx: ProduitContexte,
  date: Date,
  options: OptionsCout = {},
): AnalyseMarge {
  const complet = coutComplet(ctx, date, options);
  return analyseMargeSurCout(prixCessionHT, complet);
}

/** Variante prenant un coût complet déjà calculé. */
export function analyseMargeSurCout(
  prixCessionHT: Numeric,
  coutComplet: Numeric,
): AnalyseMarge {
  const prix = d(prixCessionHT);
  const cout = d(coutComplet);
  const marge = prix.minus(cout);
  return {
    coutComplet: cout,
    prixCessionHT: prix,
    marge,
    tauxMarque: prix.isZero() ? new Decimal(0) : marge.div(prix),
    coefficient: cout.isZero() ? new Decimal(0) : prix.div(cout),
  };
}

/**
 * Coût complet moyen de la gamme (repère d'affichage uniquement).
 * `couts` = coûts complets non arrondis des produits de la gamme.
 */
export function moyenneGamme(couts: Numeric[]): Decimal {
  return moyenne(couts);
}

/**
 * Coût complet moyen de la gamme calculé depuis les contextes produits.
 * Repère d'affichage uniquement — jamais une base de marge (§5.2).
 */
export function moyenneGammeDepuisContextes(
  contextes: readonly ProduitContexte[],
  date: Date,
  options: OptionsCout = {},
): Decimal {
  const couts = contextes.map((ctx) => decompositionCout(ctx, date, options).complet);
  return moyenne(couts);
}
