export { Decimal, d, arrondi2, moyenne } from "./decimal";
export type { Numeric } from "./decimal";
export { valeurAuJour, valeurAuJourParGroupe } from "./valeurAuJour";
export {
  CLE_TAUX_PERTE,
  tauxPerte,
  coutLiquide,
  coutConditionnement,
  coutFaconnage,
  decompositionCout,
  coutComplet,
} from "./cout";
export {
  analyseMarge,
  analyseMargeSurCout,
  moyenneGamme,
  moyenneGammeDepuisContextes,
} from "./marge";
export { agregatsCommande } from "./commande";
export type * from "./types";
