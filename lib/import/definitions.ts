import { dateValide, decimalPositif } from "@/lib/validation";
/** Définition des trois cibles d'import (§9) et de leurs champs. */

export type TypeCible = "composants" | "grille_prix" | "commandes";

export interface ChampCible {
  cle: string;
  libelle: string;
  requis: boolean;
  /** Exemple affiché dans le modèle téléchargeable. */
  exemple: string;
}

export interface DefinitionCible {
  libelle: string;
  champs: ChampCible[];
}

export const CIBLES: Record<TypeCible, DefinitionCible> = {
  composants: {
    libelle: "Composants",
    champs: [
      { cle: "format", libelle: "format", requis: true, exemple: "30 ml" },
      { cle: "libelle", libelle: "libellé", requis: true, exemple: "Flacon + boîte" },
      { cle: "coutUnitHT", libelle: "coût unitaire HT", requis: true, exemple: "1.25" },
      { cle: "optionnel", libelle: "optionnel (oui/non)", requis: false, exemple: "non" },
    ],
  },
  grille_prix: {
    libelle: "Grille tarifaire",
    champs: [
      { cle: "client", libelle: "client", requis: true, exemple: "Client exemple" },
      { cle: "sku", libelle: "SKU", requis: true, exemple: "MERCURA-REF-30" },
      { cle: "prixCessionHT", libelle: "prix de vente HT", requis: true, exemple: "18.00" },
    ],
  },
  commandes: {
    libelle: "Commandes",
    champs: [
      { cle: "reference", libelle: "référence", requis: true, exemple: "C-0100" },
      { cle: "client", libelle: "client", requis: true, exemple: "Client exemple" },
      { cle: "date", libelle: "date (JJ/MM/AAAA)", requis: true, exemple: "01/09/2026" },
      { cle: "sku", libelle: "SKU", requis: true, exemple: "MERCURA-REF-30" },
      { cle: "qte", libelle: "quantité", requis: true, exemple: "24" },
      { cle: "puHT", libelle: "prix unitaire HT", requis: true, exemple: "18.00" },
      { cle: "offert", libelle: "offert (oui/non)", requis: false, exemple: "non" },
    ],
  },
};

/** Mapping en-tête source → clé de champ cible. */
export type Mapping = Record<string, string>;

/** Ligne source déjà projetée sur les champs cibles (valeurs brutes en chaîne). */
export type LigneProjetee = Record<string, string>;

export type StatutLigne = "ok" | "erreur" | "doublon";

export interface LignePrevisualisee {
  index: number;
  valeurs: LigneProjetee;
  statut: StatutLigne;
  motif?: string;
}

export type ChoixDoublon = "creer" | "maj" | "ignorer";

/** Interprète oui/non, true/false, 1/0. */
export function litBooleen(v: string | undefined): boolean {
  if (!v) return false;
  return ["oui", "o", "true", "vrai", "1", "x"].includes(v.trim().toLowerCase());
}

/** Date au format JJ/MM/AAAA ou AAAA-MM-JJ ; null si invalide. */
export function litDate(v: string | undefined): Date | null {
  if (!v) return null;
  const s = v.trim();
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = fr ? `${fr[3]}-${fr[2]!.padStart(2, "0")}-${fr[1]!.padStart(2, "0")}` : s;
  return dateValide(iso) ? new Date(`${iso}T00:00:00.000Z`) : null;
}

export function litNombre(v: string | undefined): string | null {
  const parsed = decimalPositif.safeParse(v);
  return parsed.success ? parsed.data : null;
}
