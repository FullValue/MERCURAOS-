import Decimal from "decimal.js";

// Précision large : aucune valeur intermédiaire n'est arrondie (§5.2).
// L'arrondi à 2 décimales n'intervient qu'à l'affichage.
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Valeur numérique acceptée en entrée du moteur : Decimal, number ou string. */
export type Numeric = Decimal | number | string;

/** Normalise une entrée en Decimal. */
export function d(x: Numeric): Decimal {
  return x instanceof Decimal ? x : new Decimal(x);
}

/**
 * Decimal depuis une saisie clavier : accepte la virgule française, les
 * espaces et les saisies partielles (« 3, », « - », «  »). Retourne 0 tant
 * que la valeur n'est pas un nombre — ne lève jamais d'exception.
 */
export function dSaisie(texte: string | null | undefined): Decimal {
  const propre = (texte ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/\.$/, "");
  return /^-?\d+(\.\d+)?$/.test(propre) ? new Decimal(propre) : new Decimal(0);
}

/** Arrondi d'AFFICHAGE uniquement, à 2 décimales (jamais utilisé en calcul intermédiaire). */
export function arrondi2(x: Numeric): Decimal {
  return d(x).toDecimalPlaces(2);
}

/** Moyenne arithmétique d'une liste de Decimal (retourne 0 si vide). */
export function moyenne(valeurs: Numeric[]): Decimal {
  if (valeurs.length === 0) return new Decimal(0);
  const somme = valeurs.reduce<Decimal>((acc, v) => acc.plus(d(v)), new Decimal(0));
  return somme.div(valeurs.length);
}
