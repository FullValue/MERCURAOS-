import { d, type Numeric } from "@/lib/calcul/decimal";
import { coefficient as fmtCoef, euro as fmtEuro, pourcent } from "@/lib/format";
import { SEUIL_ALERTE_MARGE } from "@/lib/constantes";
import { Definition } from "./Definition";
import type { CleGlossaire } from "@/lib/glossaire";

/** Montant en euros, optionnellement défini au survol. */
export function Euro({
  valeur,
  terme,
}: {
  valeur: Numeric;
  terme?: CleGlossaire;
}) {
  const texte = fmtEuro(valeur);
  return terme ? (
    <Definition terme={terme} discret>
      {texte}
    </Definition>
  ) : (
    <span className="tabulaire">{texte}</span>
  );
}

/** Coefficient multiplicateur (« 1,69× »). */
export function Coefficient({ valeur }: { valeur: Numeric }) {
  return (
    <Definition terme="coefficient" discret>
      {fmtCoef(valeur)}
    </Definition>
  );
}

/**
 * Taux de marque. Passe en --alerte sous le seuil (défaut 35 %, §8.6).
 * `terme` par défaut : taux de marque brut (celui qui porte l'alerte).
 */
export function TauxMarque({
  valeur,
  seuil = SEUIL_ALERTE_MARGE,
  terme = "tauxMarqueBrut",
}: {
  valeur: Numeric;
  seuil?: number;
  terme?: CleGlossaire;
}) {
  const sousSeuil = d(valeur).lt(seuil);
  return (
    <span className={sousSeuil ? "sous-seuil tabulaire" : "tabulaire"}>
      <Definition terme={terme} discret>
        {pourcent(valeur)}
      </Definition>
    </span>
  );
}
