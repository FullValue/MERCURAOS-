"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterChargeGlobale,
  supprimerChargeGlobale,
} from "@/app/(app)/synthese/actions";
import { euro, dateCourte } from "@/lib/format";
import type { ChargeGlobaleLigne } from "@/lib/donnees/synthese";

const LIBELLE_PERIODICITE: Record<string, string> = {
  PONCTUELLE: "ponctuelle",
  MENSUELLE: "mensuelle",
  ANNUELLE: "annuelle",
};

export function ChargesGlobales({ charges }: { charges: ChargeGlobaleLigne[] }) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [periodicite, setPeriodicite] = useState("PONCTUELLE");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div>
      {charges.length > 0 && (
        <table className="tableau max-w-[720px]">
          <thead>
            <tr>
              <th>libellé</th>
              <th>périodicité</th>
              <th>depuis</th>
              <th className="num">montant HT</th>
              <th className="num">imputé à la période</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id}>
                <td>{c.libelle}</td>
                <td>
                  <span className="etiquette">{LIBELLE_PERIODICITE[c.periodicite]}</span>
                </td>
                <td>{dateCourte(new Date(c.date))}</td>
                <td className="num tabulaire">{euro(c.montantHT)}</td>
                <td className="num tabulaire">{euro(c.impute)}</td>
                <td>
                  <button
                    className="lien-discret"
                    disabled={enCours}
                    onClick={() =>
                      demarrer(async () => {
                        await supprimerChargeGlobale(c.id);
                        router.refresh();
                      })
                    }
                  >
                    supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2">
          <span className="etiquette">libellé</span>
          <input className="champ w-[220px]" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">montant HT</span>
          <input className="champ w-[120px] text-right" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">périodicité</span>
          <select className="champ w-[150px]" value={periodicite} onChange={(e) => setPeriodicite(e.target.value)}>
            <option value="PONCTUELLE">ponctuelle</option>
            <option value="MENSUELLE">mensuelle</option>
            <option value="ANNUELLE">annuelle</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">date</span>
          <input type="date" className="champ w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button
          className="bouton-plein"
          disabled={enCours || !libelle.trim() || !montant.trim()}
          onClick={() =>
            demarrer(async () => {
              const r = await ajouterChargeGlobale({ libelle, montantHT: montant, periodicite, date });
              setMessage(r.message);
              if (r.ok) {
                setLibelle("");
                setMontant("");
                router.refresh();
              }
            })
          }
        >
          {enCours ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      {message && <p className="mt-3 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
