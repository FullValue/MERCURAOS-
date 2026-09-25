"use client";

import { useMemo, useState } from "react";
import { Decimal, dSaisie } from "@/lib/calcul/decimal";
import { analyseMargeSurCout, moyenneGamme } from "@/lib/calcul";
import { euro, pourcent, coefficient as fmtCoef } from "@/lib/format";
import { SEUIL_ALERTE_MARGE } from "@/lib/constantes";
import { Definition } from "@/components/ui/Definition";
import { FiletDeCharge } from "@/components/ui/FiletDeCharge";

export interface ProduitSimulable {
  produitId: string;
  parfumNom: string;
  formatLibelle: string;
  coutComplet: string;
  prixReference: string | null;
}

interface Props {
  produits: ProduitSimulable[];
}

/** Bornes déduites des vrais coûts et du prix courant de la référence. */
function bornesJauge(prix: string, cout: string) {
  return { min: 0, max: Math.max(10, Math.ceil(Math.max(Number(prix) * 2, Number(cout) * 4))), step: 0.1 };
}

function prixInitial(p: ProduitSimulable): string {
  if (p.prixReference) return p.prixReference;
  // Sans grille : proposition à 2× le coût complet, arrondie au dixième.
  return new Decimal(p.coutComplet).mul(2).toDecimalPlaces(1).toString();
}

function LigneProduit({
  produit,
  prix,
  onChange,
}: {
  produit: ProduitSimulable;
  prix: string;
  onChange: (valeur: string) => void;
}) {
  const bornes = bornesJauge(prixInitial(produit), produit.coutComplet);
  const analyse = useMemo(
    () => analyseMargeSurCout(dSaisie(prix), new Decimal(produit.coutComplet)),
    [prix, produit.coutComplet],
  );
  const sousSeuil = analyse.tauxMarque.lt(SEUIL_ALERTE_MARGE);
  const valeurJauge = dSaisie(prix).toNumber();

  return (
    <div className="border-b border-filet py-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] text-encre">{produit.parfumNom}</span>
        <label className="flex items-baseline gap-2">
          <span className="etiquette">€ HT</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={prix}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Prix de vente HT — ${produit.parfumNom} ${produit.formatLibelle}`}
            className="champ w-[92px] text-right"
          />
        </label>
      </div>

      <input
        type="range"
        min={bornes.min}
        max={bornes.max}
        step={bornes.step}
        value={Math.min(Math.max(valeurJauge, bornes.min), bornes.max)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Jauge de prix — ${produit.parfumNom} ${produit.formatLibelle}`}
        className="jauge mt-3"
      />

      <div className="mt-2 flex items-baseline gap-5">
        <span className="etiquette">
          <Definition terme="coutComplet">coût</Definition>{" "}
          <span className="num tabulaire text-[13px] text-encre">
            {euro(produit.coutComplet)}
          </span>
        </span>
        <span className="etiquette">
          <Definition terme="marge">marge</Definition>{" "}
          <span className="num tabulaire text-[13px] text-encre">
            {euro(analyse.marge)}
          </span>
        </span>
        <span className="etiquette">
          <Definition terme="tauxMarque">marge en %</Definition>{" "}
          <span
            className={`num tabulaire text-[13px] ${sousSeuil ? "sous-seuil" : "text-encre"}`}
          >
            {pourcent(analyse.tauxMarque)}
          </span>
        </span>
        <span className="etiquette">
          <Definition terme="coefficient">coef.</Definition>{" "}
          <span className="num tabulaire text-[13px] text-encre">
            {fmtCoef(analyse.coefficient)}
          </span>
        </span>
      </div>

      <div className="mt-2">
        <FiletDeCharge coutComplet={produit.coutComplet} prixCessionHT={dSaisie(prix)} />
      </div>
    </div>
  );
}

function ColonneFormat({
  titre,
  produits,
  prix,
  onChange,
}: {
  titre: string;
  produits: ProduitSimulable[];
  prix: Record<string, string>;
  onChange: (produitId: string, valeur: string) => void;
}) {
  // Repère d'affichage uniquement — jamais une base de calcul (§5.2).
  const tauxMoyen = useMemo(() => {
    const taux = produits.map((p) => {
      const a = analyseMargeSurCout(
        dSaisie(prix[p.produitId]),
        new Decimal(p.coutComplet),
      );
      return a.tauxMarque;
    });
    return taux.length ? moyenneGamme(taux) : new Decimal(0);
  }, [produits, prix]);

  return (
    <section aria-label={`Colonne ${titre}`}>
      <div className="flex items-baseline justify-between border-b-2 border-encre pb-2">
        <h2 className="font-titre text-[24px] font-light text-encre">{titre}</h2>
        <span className="etiquette">
          marge moyenne en %{" "}
          <span
            className={`num tabulaire text-[13px] ${
              tauxMoyen.lt(SEUIL_ALERTE_MARGE) ? "sous-seuil" : "text-encre"
            }`}
          >
            {pourcent(tauxMoyen)}
          </span>
        </span>
      </div>
      {produits.map((p) => (
        <LigneProduit
          key={p.produitId}
          produit={p}
          prix={prix[p.produitId] ?? "0"}
          onChange={(v) => onChange(p.produitId, v)}
        />
      ))}
    </section>
  );
}

/**
 * Simulateur de catalogue : références regroupées par format,
 * prix ajustable à la jauge ou au clavier, impact recalculé à chaque
 * geste. Simulation d'affichage : rien n'est enregistré.
 */
export function SimulateurCatalogue({ produits }: Props) {
  const initiaux = useMemo(
    () =>
      Object.fromEntries(produits.map((p) => [p.produitId, prixInitial(p)])),
    [produits],
  );
  const [prix, setPrix] = useState<Record<string, string>>(initiaux);

  const changer = (produitId: string, valeur: string) =>
    setPrix((etat) => ({ ...etat, [produitId]: valeur }));

  const modifie = produits.some((p) => prix[p.produitId] !== initiaux[p.produitId]);

  const formats = [...new Set(produits.map((p) => p.formatLibelle))]
    .sort((a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0) || a.localeCompare(b, "fr"));
  const colonnes = formats.map((libelle) => ({
    libelle,
    produits: produits.filter((p) => p.formatLibelle === libelle),
  })).filter((c) => c.produits.length > 0);

  return (
    <div>
      {produits.length === 0 && <p className="mt-8 text-[14px] text-lecture">Aucune référence à simuler. Créez les formats, parfums et références dans le Registre des coûts.</p>}
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] text-lecture">
          Ajustez le <Definition terme="prixCession">prix de vente</Definition>{" "}
          à la jauge ou au clavier : marge, marge en % et coefficient se
          recalculent aussitôt. Simulation seulement — rien n&apos;est
          enregistré.
        </p>
        {modifie && (
          <button
            type="button"
            onClick={() => setPrix(initiaux)}
            className="lien-discret shrink-0"
          >
            revenir aux prix de référence
          </button>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-2 xl:grid-cols-3">
        {colonnes.map((c) => (
          <ColonneFormat
            key={c.libelle}
            titre={c.libelle}
            produits={c.produits}
            prix={prix}
            onChange={changer}
          />
        ))}
      </div>
    </div>
  );
}
