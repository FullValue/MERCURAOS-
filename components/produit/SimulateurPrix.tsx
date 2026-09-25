"use client";

import { useMemo, useState } from "react";
import { dSaisie } from "@/lib/calcul/decimal";
import type { ProduitContexte } from "@/lib/calcul/types";
import { decompositionCout, analyseMargeSurCout } from "@/lib/calcul";
import { euro, pourcent, coefficient as fmtCoef } from "@/lib/format";
import { SEUIL_ALERTE_MARGE } from "@/lib/constantes";
import { Definition } from "@/components/ui/Definition";

interface Props {
  /** Coût matière + conditionnement (fixe, indépendant de la quantité). */
  contexte: ProduitContexte;
  dateEffet: string;
  qteLotDefaut: number;
  prixDefaut?: string;
}

/**
 * Simulateur de prix de cession (§8.3). Marge, taux de marque et coefficient se
 * recalculent à la frappe ; la quantité de lot fait bouger le façonnage, donc
 * tout le reste. Calcul en Decimal, arrondi à l'affichage seulement.
 */
export function SimulateurPrix({
  contexte,
  dateEffet,
  qteLotDefaut,
  prixDefaut = "0",
}: Props) {
  const [prix, setPrix] = useState(prixDefaut);
  const [qteLot, setQteLot] = useState(String(qteLotDefaut));

  const analyse = useMemo(() => {
    const lot = dSaisie(qteLot);
    const dec = decompositionCout(contexte, new Date(dateEffet), { qteLot: lot.gt(0) ? lot : 1 });
    const { faconnage, complet } = dec;
    const prixDec = dSaisie(prix);
    return {
      complet,
      faconnage,
      ...analyseMargeSurCout(prixDec, complet),
    };
  }, [prix, qteLot, contexte, dateEffet]);

  const sousSeuil = analyse.tauxMarque.lt(SEUIL_ALERTE_MARGE);

  return (
    <div className="mt-12 border-t border-filet pt-6">
      <h2 className="font-titre text-[24px] font-light text-encre">
        Simuler un prix de vente
      </h2>

      <div className="mt-6 flex flex-wrap gap-8">
        <label className="flex flex-col gap-2">
          <span className="etiquette">prix de vente HT (€)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            className="champ w-[160px] text-right"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">
            <Definition terme="qteLot">quantité de lot</Definition>
          </span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={qteLot}
            onChange={(e) => setQteLot(e.target.value)}
            className="champ w-[160px] text-right"
          />
        </label>
      </div>

      <table className="tableau mt-8 max-w-[420px]">
        <tbody>
          <tr>
            <td>
              <Definition terme="faconnage">façonnage (amorti)</Definition>
            </td>
            <td className="num tabulaire">{euro(analyse.faconnage)}</td>
          </tr>
          <tr>
            <td>
              <Definition terme="coutComplet">coût complet</Definition>
            </td>
            <td className="num tabulaire">{euro(analyse.complet)}</td>
          </tr>
          <tr>
            <td>
              <Definition terme="marge">marge</Definition>
            </td>
            <td className="num tabulaire">{euro(analyse.marge)}</td>
          </tr>
          <tr>
            <td>
              <Definition terme="tauxMarque">marge en %</Definition>
            </td>
            <td className={`num tabulaire ${sousSeuil ? "sous-seuil" : ""}`}>
              {pourcent(analyse.tauxMarque)}
            </td>
          </tr>
          <tr>
            <td>
              <Definition terme="coefficient">coefficient</Definition>
            </td>
            <td className="num tabulaire">{fmtCoef(analyse.coefficient)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
