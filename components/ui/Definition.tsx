"use client";

import { useId, type ReactNode } from "react";
import { GLOSSAIRE, type CleGlossaire } from "@/lib/glossaire";

interface DefinitionProps {
  /** Clé du glossaire centralisé. */
  terme: CleGlossaire;
  /**
   * Contenu déclencheur. Par défaut, le libellé du terme dans le glossaire.
   * Passer une valeur chiffrée pour attacher la définition à un nombre.
   */
  children?: ReactNode;
  /** Rendu sans le soulignement pointillé (pour un chiffre en tableau). */
  discret?: boolean;
}

/**
 * Affiche une petite définition au survol ET au focus clavier (accessible,
 * sans couleur, dans la grammaire sobre de la DA). Adossé au glossaire unique.
 */
export function Definition({ terme, children, discret = false }: DefinitionProps) {
  const entree = GLOSSAIRE[terme];
  const id = useId();

  return (
    <span className="definition group">
      <button
        type="button"
        aria-describedby={id}
        className={
          discret
            ? "definition-declencheur definition-declencheur--discret"
            : "definition-declencheur"
        }
      >
        {children ?? entree.terme}
      </button>
      <span role="tooltip" id={id} className="definition-panneau">
        <span className="etiquette">{entree.terme}</span>
        <span className="definition-texte">{entree.definition}</span>
      </span>
    </span>
  );
}
