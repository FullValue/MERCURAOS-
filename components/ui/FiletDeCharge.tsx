import { d, type Numeric } from "@/lib/calcul/decimal";
import { pourcent } from "@/lib/format";

interface FiletDeChargeProps {
  coutComplet: Numeric;
  prixCessionHT: Numeric;
  /** Largeur du filet (défaut : pleine largeur du conteneur). */
  largeur?: number | string;
}

/**
 * Filet de charge (§3.5) : trait de 2 px dont la portion pleine noire = part du
 * coût dans le prix de cession, la portion en --filet = la marge. Aucune
 * légende : le rapport se lit directement.
 */
export function FiletDeCharge({
  coutComplet,
  prixCessionHT,
  largeur = "100%",
}: FiletDeChargeProps) {
  const prix = d(prixCessionHT);
  const ratio = prix.lte(0) ? 1 : d(coutComplet).div(prix).toNumber();
  const partCout = Math.min(1, Math.max(0, ratio));

  return (
    <div
      role="img"
      aria-label={`Coût : ${pourcent(partCout)} du prix de vente ; marge : ${pourcent(1 - partCout)}.`}
      style={{ width: largeur, height: 2, background: "var(--filet)" }}
    >
      <div style={{ width: `${partCout * 100}%`, height: 2, background: "var(--encre)" }} />
    </div>
  );
}
