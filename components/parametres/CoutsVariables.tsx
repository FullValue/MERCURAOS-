"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterCoutVariable,
  supprimerCoutVariable,
} from "@/app/(app)/parametres/actions";
import type { CoutVariableLigne } from "@/lib/donnees/parametres";
import { Decimal, dSaisie } from "@/lib/calcul/decimal";
import { horsTaxe } from "@/lib/calcul/cout";
import { euro } from "@/lib/format";
import { Definition } from "@/components/ui/Definition";

interface Props {
  couts: CoutVariableLigne[];
  /** Période (commande fournisseur) dans laquelle dater les ajouts. */
  periodeId?: string;
  tvaRecuperable?: boolean;
}

/**
 * Coûts variables de la commande fournisseur (douane, transitaire, taxes…).
 * Répartis sur le nombre de pièces livrées, avec les frais de livraison.
 */
export function CoutsVariables({ couts, periodeId, tvaRecuperable = true }: Props) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [ttc, setTtc] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const totalHT = couts.reduce(
    (acc, c) => acc.plus(horsTaxe(dSaisie(c.montant), c.tvaIncluse && tvaRecuperable)),
    new Decimal(0),
  );

  function ajouter() {
    setMessage(null);
    demarrer(async () => {
      const r = await ajouterCoutVariable({ periodeId, libelle, montant, tvaIncluse: ttc });
      setMessage(r.message);
      if (r.ok) {
        setLibelle("");
        setMontant("");
        setTtc(false);
        router.refresh();
      }
    });
  }

  function supprimer(id: string, nom: string) {
    if (!window.confirm(`Supprimer le coût variable « ${nom} » de cette période ?`)) return;
    setMessage(null);
    demarrer(async () => {
      const r = await supprimerCoutVariable({ id });
      setMessage(r.message);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div>
      {couts.length > 0 && (
        <table className="tableau max-w-[620px]">
          <thead>
            <tr>
              <th>libellé</th>
              <th className="num">montant</th>
              <th className="num">montant retenu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {couts.map((c) => (
              <tr key={c.id}>
                <td>{c.libelle}</td>
                <td className="num tabulaire">
                  {euro(c.montant)}
                  {c.tvaIncluse && <span className="etiquette ml-1">TTC</span>}
                </td>
                <td className="num tabulaire">
                  {euro(horsTaxe(dSaisie(c.montant), c.tvaIncluse && tvaRecuperable))}
                </td>
                <td>
                  <button
                    type="button"
                    className="lien-discret"
                    disabled={enCours}
                    onClick={() => supprimer(c.id, c.libelle)}
                  >
                    supprimer
                  </button>
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>total réparti sur les pièces</td>
              <td></td>
              <td className="num tabulaire">{euro(totalHT)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="etiquette">libellé</span>
          <input
            className="champ w-[220px]"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Douane, transitaire…"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">montant</span>
          <input
            className="champ w-[120px] text-right"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">
            <Definition terme="htTtc">HT / TTC</Definition>
          </span>
          <select
            className="champ h-[36px] w-[80px]"
            value={ttc ? "TTC" : "HT"}
            onChange={(e) => setTtc(e.target.value === "TTC")}
            aria-label="TVA du coût variable"
          >
            <option value="HT">HT</option>
            <option value="TTC">TTC</option>
          </select>
        </label>
        <button
          type="button"
          className="bouton-plein"
          disabled={enCours || !libelle.trim() || !montant.trim()}
          onClick={ajouter}
        >
          {enCours ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      {message && <p className="mt-3 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
