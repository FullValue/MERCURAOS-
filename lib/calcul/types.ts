import type { Numeric } from "./decimal";

/** Ligne de paramètre historisée (ex. `taux_perte`). */
export interface ParametreRow {
  cle: string;
  valeur: Numeric;
  dateEffet: Date;
}

/** Composant de conditionnement historisé, rattaché à un format. */
export interface ComposantRow {
  libelle: string;
  coutUnitHT: Numeric;
  optionnel: boolean;
  /** Le montant saisi inclut la TVA (20 %) : le moteur le ramène en HT. */
  tvaIncluse?: boolean;
  /** Ligne « Coûts de façonnage » : comptée dans le poste façonnage, pas dans le conditionnement. */
  faconnage?: boolean;
  dateEffet: Date;
}

/** Paramètre de façonnage historisé (coût de série), rattaché à un format. */
export interface FaconnageRow {
  coutFixeSerie: Numeric;
  coutVarUnitHT: Numeric;
  qteLotRef: number;
  dateEffet: Date;
}

/** Coût variable de commande fournisseur (douane, transitaire…), historisé. */
export interface CoutVariableRow {
  libelle: string;
  montant: Numeric;
  /** Le montant saisi inclut la TVA (20 %) : le moteur le ramène en HT. */
  tvaIncluse?: boolean;
  dateEffet: Date;
}

/** Prix du liquide historisé (€ HT/litre), rattaché à un parfum. */
export interface PrixLiquideRow {
  prixLitreHT: Numeric;
  /** Le montant saisi inclut la TVA (20 %) : le moteur le ramène en HT. */
  tvaIncluse?: boolean;
  dateEffet: Date;
}

/**
 * Tout le contexte nécessaire au calcul du coût d'un produit à une date donnée.
 * Les listes contiennent l'historique complet : la résolution à la date passe
 * systématiquement par `valeurAuJour`.
 */
export interface ProduitContexte {
  /** Volume du format en litres (ex. 0.05000). */
  volumeL: Numeric;
  /** Prix du liquide du parfum, € HT par litre (repli si `prixLiquides` absent). */
  prixLiquideL: Numeric;
  /** Historique daté du prix du liquide ; prioritaire sur `prixLiquideL`. */
  prixLiquides?: readonly PrixLiquideRow[];
  /** Coûts variables de commande fournisseur, répartis avec la livraison. */
  coutsVariables?: readonly CoutVariableRow[];
  /** Historique des paramètres (doit contenir `taux_perte`). */
  parametres: readonly ParametreRow[];
  /** Historique des composants du format. */
  composants: readonly ComposantRow[];
  /** Historique du façonnage du format. */
  faconnages: readonly FaconnageRow[];
}

/** Options de calcul du coût d'un produit. */
export interface OptionsCout {
  /**
   * Quantité d'amortissement du façonnage. Par défaut = `qteLotRef` du
   * façonnage applicable. Sur une commande, = quantité totale du format.
   */
  qteLot?: Numeric;
  /** Inclure les composants optionnels (ex. le sac). Défaut : false. */
  avecOptionnels?: boolean;
}

/** Décomposition détaillée du coût de revient d'un produit. */
export interface DecompositionCout {
  liquide: import("./decimal").Decimal;
  conditionnement: import("./decimal").Decimal;
  faconnage: import("./decimal").Decimal;
  /** Frais de livraison fournisseur amortis sur le lot (0 si non renseignés). */
  livraison: import("./decimal").Decimal;
  matiereEtCond: import("./decimal").Decimal;
  complet: import("./decimal").Decimal;
  /** Quantité de lot effectivement utilisée pour amortir le façonnage. */
  qteLot: import("./decimal").Decimal;
}

/** Résultat d'une analyse de marge sur un prix de cession. */
export interface AnalyseMarge {
  coutComplet: import("./decimal").Decimal;
  prixCessionHT: import("./decimal").Decimal;
  marge: import("./decimal").Decimal;
  tauxMarque: import("./decimal").Decimal;
  coefficient: import("./decimal").Decimal;
}

/** Ligne de commande, vue par le moteur d'agrégats. */
export interface LigneCalc {
  qte: Numeric;
  puHT: Numeric;
  offert: boolean;
  coutUnitFige: Numeric;
}

/** Charge rattachée, vue par le moteur d'agrégats. */
export interface ChargeCalc {
  montantHT: Numeric;
}

/** Agrégats d'une commande (§5.3). */
export interface AgregatsCommande {
  caHT: import("./decimal").Decimal;
  coutRevient: import("./decimal").Decimal;
  chargesRattachees: import("./decimal").Decimal;
  margeBrute: import("./decimal").Decimal;
  margeNette: import("./decimal").Decimal;
  /** margeBrute / caHT (§5.3). Base du seuil d'alerte 35 %. */
  tauxMarqueBrut: import("./decimal").Decimal;
  /** margeNette / caHT (indicateur « net » du test 7.5). */
  tauxMarqueNet: import("./decimal").Decimal;
}
