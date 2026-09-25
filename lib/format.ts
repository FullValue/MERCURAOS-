import { arrondi2, d, type Numeric } from "@/lib/calcul/decimal";

const fmtEuro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const fmtNombre = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Montant en euros, arrondi à l'affichage uniquement (§12). Ex. « 11,85 € ». */
export function euro(x: Numeric): string {
  return fmtEuro.format(arrondi2(x).toNumber());
}

/** Nombre décimal français (jusqu'à 2 décimales). */
export function nombre(x: Numeric): string {
  return fmtNombre.format(d(x).toNumber());
}

/** Taux de marque : une fraction (0.407) → « 40,7 % ». */
export function pourcent(fraction: Numeric, decimales = 1): string {
  const val = d(fraction).mul(100).toDecimalPlaces(decimales).toNumber();
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(val)} %`;
}

/** Coefficient multiplicateur : 1.687 → « 1,69× ». */
export function coefficient(x: Numeric): string {
  const val = d(x).toDecimalPlaces(2).toNumber();
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)}×`;
}

/** Points d'écart de taux de marque : 0.06 → « +6,0 pts ». */
export function points(fraction: Numeric, decimales = 1): string {
  const val = d(fraction).mul(100).toDecimalPlaces(decimales).toNumber();
  const signe = val > 0 ? "+" : "";
  return `${signe}${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(val)} pts`;
}

/** Date courte française. Ex. « 23 juillet 2026 ». */
export function dateLongue(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Date numérique française. Ex. « 23/07/2026 ». */
export function dateCourte(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
