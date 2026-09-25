import type { RoleClient } from "@prisma/client";

const LIBELLES: Record<RoleClient, string> = {
  DISTRIBUTEUR: "distributeur",
  REVENDEUR: "revendeur",
  CORNER: "corner",
  D2C: "vente directe",
  PROSPECT: "prospect",
};

/**
 * Pastille de rôle (§8.4) : libellé 11 px mono, contour 1 px --filet, texte
 * --lecture. Exception : DISTRIBUTEUR s'affiche inversé (aplat --encre / texte
 * --papier), seul aplat noir de l'interface.
 */
export function PastilleRole({ role }: { role: RoleClient }) {
  const inverse = role === "DISTRIBUTEUR";
  return (
    <span
      className="etiquette inline-flex items-center"
      style={{
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-fin)",
        border: inverse ? "1px solid var(--encre)" : "1px solid var(--filet)",
        background: inverse ? "var(--encre)" : "transparent",
        color: inverse ? "var(--papier)" : "var(--lecture)",
      }}
    >
      {LIBELLES[role]}
    </span>
  );
}
