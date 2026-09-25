"use client";

import { useState, useTransition } from "react";
import { euro, dateCourte } from "@/lib/format";
import { Definition } from "@/components/ui/Definition";
import type { LigneGrilleFiche } from "@/lib/donnees/client";
import { enregistrerGrille } from "@/app/(app)/clients/actions";

export function GrilleEditeur({
  clientId,
  grille,
}: {
  clientId: string;
  grille: LigneGrilleFiche[];
}) {
  const [valeurs, setValeurs] = useState<Record<string, string>>(
    Object.fromEntries(grille.map((g) => [g.produitId, g.prixCourant ?? ""])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    setMessage(null);
    const diffs = grille
      .filter((g) => {
        const v = valeurs[g.produitId]?.trim() ?? "";
        return v !== "" && v !== (g.prixCourant ?? "");
      })
      .map((g) => ({
        produitId: g.produitId,
        prixCessionHT: valeurs[g.produitId]!.trim(),
      }));
    if (diffs.length === 0) {
      setMessage("Aucune modification.");
      return;
    }
    demarrer(async () => {
      const r = await enregistrerGrille({ clientId, lignes: diffs });
      setMessage(r.message);
    });
  }

  return (
    <div>
      <table className="tableau max-w-[720px]">
        <thead>
          <tr>
            <th>référence</th>
            <th>format</th>
            <th className="num">
              <Definition terme="prixCession">prix de vente HT</Definition>
            </th>
            <th>historique</th>
          </tr>
        </thead>
        <tbody>
          {grille.map((g) => (
            <tr key={g.produitId}>
              <td>{g.parfumNom}</td>
              <td>
                <span className="etiquette">{g.formatLibelle}</span>
              </td>
              <td className="num">
                <input
                  className="valeur-editable"
                  inputMode="decimal"
                  placeholder="—"
                  value={valeurs[g.produitId] ?? ""}
                  onChange={(e) =>
                    setValeurs((prev) => ({ ...prev, [g.produitId]: e.target.value }))
                  }
                  aria-label={`prix ${g.parfumNom} ${g.formatLibelle}`}
                />
              </td>
              <td>
                {g.historique.length > 1 && (
                  <details>
                    <summary className="lien-discret list-none">historique</summary>
                    <ul className="mt-1">
                      {g.historique.map((h, i) => (
                        <li key={i} className="etiquette">
                          {dateCourte(new Date(h.dateEffet))} — {euro(h.prix)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-4">
        <button className="bouton-plein" onClick={enregistrer} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer la grille"}
        </button>
        {message && <span className="text-[13px] text-lecture">{message}</span>}
      </div>
    </div>
  );
}
