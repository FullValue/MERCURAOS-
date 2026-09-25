"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { annulerImport } from "@/app/(app)/import/actions";
import { dateCourte } from "@/lib/format";

export interface ImportLigne {
  id: string;
  nomFichier: string;
  typeCible: string;
  statut: string;
  lignesOk: number;
  lignesErreur: number;
  createdAt: string; // ISO
}

const LIBELLE_TYPE: Record<string, string> = {
  composants: "composants",
  grille_prix: "grille tarifaire",
  commandes: "commandes",
};
const LIBELLE_STATUT: Record<string, string> = {
  PREVISUALISATION: "prévisualisation",
  APPLIQUE: "appliqué",
  ANNULE: "annulé",
};

export function HistoriqueImports({ imports }: { imports: ImportLigne[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (imports.length === 0) {
    return <p className="text-[13px] text-lecture">Aucun import.</p>;
  }

  return (
    <div>
      <table className="tableau">
        <thead>
          <tr>
            <th>date</th>
            <th>fichier</th>
            <th>cible</th>
            <th className="num">lignes ok</th>
            <th className="num">ignorées</th>
            <th>statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {imports.map((i) => (
            <tr key={i.id}>
              <td>{dateCourte(new Date(i.createdAt))}</td>
              <td>{i.nomFichier}</td>
              <td>
                <span className="etiquette">{LIBELLE_TYPE[i.typeCible] ?? i.typeCible}</span>
              </td>
              <td className="num tabulaire">{i.lignesOk}</td>
              <td className="num tabulaire">{i.lignesErreur}</td>
              <td>
                <span className="etiquette">{LIBELLE_STATUT[i.statut] ?? i.statut}</span>
              </td>
              <td>
                {i.statut === "APPLIQUE" && (
                  <button
                    className="lien-discret"
                    disabled={enCours}
                    onClick={() =>
                      demarrer(async () => {
                        const r = await annulerImport(i.id);
                        setMessage(r.message);
                        router.refresh();
                      })
                    }
                  >
                    annuler
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="mt-3 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
