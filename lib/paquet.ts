import { Decimal } from "@/lib/calcul/decimal";

export type ElementPaquet =
  | { type: "format"; formatId: string; quantite: number }
  | { type: "composant"; formatId: string; libelle: string; quantite: number };

export interface OptionPaquet {
  type: ElementPaquet["type"];
  formatId: string;
  libelle: string;
  nom: string;
  cout?: string;
  parfumNom?: string;
}

export function cleElement(e: { type: ElementPaquet["type"]; formatId: string; libelle?: string }): string {
  return `${e.type}:${e.formatId}:${e.type === "composant" ? e.libelle : ""}`;
}

export function optionsFormats(lignes: { formatId: string; formatLibelle: string }[]): OptionPaquet[] {
  const vues = new Set<string>();
  return lignes.filter((l) => {
    if (vues.has(l.formatId)) return false;
    vues.add(l.formatId);
    return true;
  }).map((l) => ({ type: "format", formatId: l.formatId, libelle: l.formatLibelle, nom: l.formatLibelle }));
}

export function compositionParDefaut(options: OptionPaquet[]): ElementPaquet[] {
  const formats = options.filter((o) => o.type === "format").slice(0, 2);
  const composants = options.filter((o) => o.type === "composant");
  return [...formats, ...composants].map((o) => o.type === "format"
    ? { type: "format" as const, formatId: o.formatId, quantite: 1 }
    : { type: "composant" as const, formatId: o.formatId, libelle: o.libelle, quantite: 1 });
}

export function coutElement(
  element: ElementPaquet,
  parfumNom: string,
  produits: { parfumNom: string; formatId: string; cout: string }[],
  composants: { formatId: string; libelle: string; cout: string }[],
): Decimal | null {
  const valeur = element.type === "format"
    ? produits.find((p) => p.parfumNom === parfumNom && p.formatId === element.formatId)?.cout
    : composants.find((c) => c.formatId === element.formatId && c.libelle === element.libelle)?.cout;
  return valeur === undefined ? null : new Decimal(valeur).mul(element.quantite);
}

export function coutPaquet(
  elements: ElementPaquet[],
  parfumNom: string,
  produits: { parfumNom: string; formatId: string; cout: string }[],
  composants: { formatId: string; libelle: string; cout: string }[],
): Decimal | null {
  let total = new Decimal(0);
  for (const element of elements) {
    const valeur = coutElement(element, parfumNom, produits, composants);
    if (valeur === null) return null;
    total = total.plus(valeur);
  }
  return total;
}
