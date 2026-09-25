import { d, type Numeric } from "@/lib/calcul/decimal";
import { euro } from "@/lib/format";
import { Definition } from "./Definition";
import type { CleGlossaire } from "@/lib/glossaire";

interface ColonneCoutProps {
  liquide: Numeric;
  conditionnement: Numeric;
  faconnage: Numeric;
  /** Hauteur de la colonne en px (défaut 200, §3.5). */
  hauteur?: number;
}

interface Segment {
  cle: Extract<CleGlossaire, "liquide" | "conditionnement" | "faconnage">;
  montant: Numeric;
  h: number;
  y: number;
}

/**
 * Élément signature (§3.5) : colonne verticale de 12 px, empilant les trois
 * postes proportionnellement — liquide plein, conditionnement 35 %, façonnage
 * en hachures 45°. Montants à droite, centrés sur leur segment, définis au
 * survol. Aucune couleur : plein / gris / hachure.
 */
export function ColonneCout({
  liquide,
  conditionnement,
  faconnage,
  hauteur = 200,
}: ColonneCoutProps) {
  const total = d(liquide).plus(conditionnement).plus(faconnage);
  const part = (m: Numeric) =>
    total.isZero() ? 0 : d(m).div(total).mul(hauteur).toNumber();

  // Empilement du haut vers le bas : façonnage, conditionnement, liquide.
  const hF = part(faconnage);
  const hC = part(conditionnement);
  const hL = Math.max(0, hauteur - hF - hC); // absorbe l'arrondi sur le socle
  const segments: Segment[] = [
    { cle: "faconnage", montant: faconnage, h: hF, y: 0 },
    { cle: "conditionnement", montant: conditionnement, h: hC, y: hF },
    { cle: "liquide", montant: liquide, h: hL, y: hF + hC },
  ];

  const largeur = 12;

  return (
    <div className="relative" style={{ height: hauteur, width: 168 }}>
      <svg
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        className="absolute left-0 top-0 text-encre"
        aria-hidden="true"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <pattern
            id="hachures-cout"
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        {/* Façonnage — hachures */}
        <rect x="0" y={segments[0]!.y} width={largeur} height={segments[0]!.h} fill="url(#hachures-cout)" />
        <rect
          x="0.5"
          y={segments[0]!.y + 0.5}
          width={largeur - 1}
          height={Math.max(0, segments[0]!.h - 1)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        {/* Conditionnement — 35 % */}
        <rect x="0" y={segments[1]!.y} width={largeur} height={segments[1]!.h} fill="currentColor" fillOpacity="0.35" />
        {/* Liquide — plein */}
        <rect x="0" y={segments[2]!.y} width={largeur} height={segments[2]!.h} fill="currentColor" />
      </svg>

      {segments.map((s) => (
        <div
          key={s.cle}
          className="absolute etiquette"
          style={{
            left: largeur + 12,
            top: s.h > 0 ? s.y + s.h / 2 - 8 : s.y - 8,
            color: "var(--encre)",
          }}
        >
          <Definition terme={s.cle} discret>
            {euro(s.montant)}
          </Definition>
        </div>
      ))}
    </div>
  );
}
