import { Decimal, d } from "./decimal";
import type { AgregatsCommande, ChargeCalc, LigneCalc } from "./types";

/**
 * Agrégats d'une commande (§5.3). Aucun arrondi intermédiaire (§5.2).
 *
 * CA_HT        = Σ (qte × puHT) sur les lignes NON offertes
 * coûtRevient  = Σ (qte × coutUnitFige) sur TOUTES les lignes, offertes comprises
 * chargesRattachées = Σ charges
 * margeBrute   = CA_HT − coûtRevient
 * margeNette   = margeBrute − chargesRattachées
 * tauxMarqueBrut = margeBrute / CA_HT
 * tauxMarqueNet  = margeNette / CA_HT
 */
export function agregatsCommande(
  lignes: readonly LigneCalc[],
  charges: readonly ChargeCalc[] = [],
): AgregatsCommande {
  const caHT = lignes.reduce<Decimal>((acc, l) => {
    if (l.offert) return acc;
    return acc.plus(d(l.qte).mul(l.puHT));
  }, new Decimal(0));

  const coutRevient = lignes.reduce<Decimal>(
    (acc, l) => acc.plus(d(l.qte).mul(l.coutUnitFige)),
    new Decimal(0),
  );

  const chargesRattachees = charges.reduce<Decimal>(
    (acc, c) => acc.plus(d(c.montantHT)),
    new Decimal(0),
  );

  const margeBrute = caHT.minus(coutRevient);
  const margeNette = margeBrute.minus(chargesRattachees);

  return {
    caHT,
    coutRevient,
    chargesRattachees,
    margeBrute,
    margeNette,
    tauxMarqueBrut: caHT.isZero() ? new Decimal(0) : margeBrute.div(caHT),
    tauxMarqueNet: caHT.isZero() ? new Decimal(0) : margeNette.div(caHT),
  };
}
