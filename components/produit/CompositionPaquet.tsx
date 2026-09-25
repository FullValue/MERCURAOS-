"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerCompositionPaquet } from "@/app/(app)/catalogue/actions";
import { cleElement, coutElement, coutPaquet, type ElementPaquet, type OptionPaquet } from "@/lib/paquet";
import { euro } from "@/lib/format";
import { Definition } from "@/components/ui/Definition";

interface Props {
  initiale: ElementPaquet[];
  options: OptionPaquet[];
  produits: { parfumNom: string; formatId: string; cout: string }[];
  composants: { formatId: string; libelle: string; cout: string }[];
}

export function CompositionPaquet({ initiale, options, produits, composants }: Props) {
  const router = useRouter();
  const [elements, setElements] = useState(initiale);
  const [selection, setSelection] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, demarrer] = useTransition();
  const parfums = [...new Set(produits.map((p) => p.parfumNom))].sort((a, b) => a.localeCompare(b, "fr"));
  const optionsRestantes = options.filter((o) => !elements.some((e) => cleElement(e) === cleElement(o)));
  const modifie = JSON.stringify(elements) !== JSON.stringify(initiale);

  function ajouter() {
    const option = optionsRestantes.find((o) => cleElement(o) === selection);
    if (!option) return;
    setElements((courants) => [...courants, option.type === "format"
      ? { type: "format", formatId: option.formatId, quantite: 1 }
      : { type: "composant", formatId: option.formatId, libelle: option.libelle, quantite: 1 }]);
    setSelection("");
    setMessage("");
  }

  function quantite(index: number, valeur: number) {
    setElements((courants) => courants.map((e, i) => i === index ? { ...e, quantite: valeur } : e));
    setMessage("");
  }

  function enregistrer() {
    if (!elements.length || elements.some((e) => !Number.isInteger(e.quantite) || e.quantite < 1 || e.quantite > 100)) {
      setMessage("Ajoutez au moins un élément avec une quantité de 1 à 100.");
      return;
    }
    demarrer(async () => {
      try {
        const resultat = await enregistrerCompositionPaquet(elements);
        setMessage(resultat.message);
        if (resultat.ok) router.refresh();
      } catch {
        setMessage("Enregistrement impossible. Réessayez.");
      }
    });
  }

  return (
    <div>
      <p className="mt-2 text-[13px] text-lecture">
        Ajoutez ou retirez des formats et des éléments optionnels. Le total se recalcule immédiatement
        pour la période sélectionnée ; enregistrez pour partager la composition.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="etiquette">ajouter au paquet</span>
          <select className="champ min-w-[190px]" value={selection} onChange={(e) => setSelection(e.target.value)}>
            <option value="">Choisir un élément</option>
            {optionsRestantes.filter((o) => o.type === "format").map((o) => (
              <option key={cleElement(o)} value={cleElement(o)}>Format {o.nom}</option>
            ))}
            {optionsRestantes.filter((o) => o.type === "composant").map((o) => (
              <option key={cleElement(o)} value={cleElement(o)}>{o.nom}</option>
            ))}
          </select>
        </label>
        <button type="button" className="bouton-plein" disabled={!selection || enCours} onClick={ajouter}>Ajouter</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {elements.map((element, index) => {
          const option = options.find((o) => cleElement(o) === cleElement(element));
          return (
            <div key={cleElement(element)} className="flex items-center gap-2 border border-filet px-3 py-2">
              <span className="text-[14px] text-encre">{option?.nom ?? "Élément indisponible"}</span>
              <label className="flex items-center gap-1 text-[13px] text-lecture">
                <span>×</span>
                <input type="number" min="1" max="100" step="1" aria-label={`Quantité ${option?.nom ?? "élément"}`}
                  className="champ w-[62px] text-right" value={element.quantite}
                  onChange={(e) => quantite(index, e.target.value === "" ? 0 : Number(e.target.value))} />
              </label>
              <button type="button" className="lien-discret ml-2" aria-label={`Retirer ${option?.nom ?? "élément"}`}
                onClick={() => { setElements((courants) => courants.filter((_, i) => i !== index)); setMessage(""); }}>
                retirer
              </button>
            </div>
          );
        })}
      </div>
      {!elements.length && <p className="mt-3 text-[13px] text-lecture">Le paquet est vide. Ajoutez un format ou un élément.</p>}
      <div className="mt-5 flex items-center gap-4">
        <button type="button" className="bouton-plein" disabled={!modifie || enCours || !elements.length} onClick={enregistrer}>
          {enCours ? "Enregistrement…" : "Enregistrer la composition"}
        </button>
        {message && <p role="status" className="text-[13px] text-lecture">{message}</p>}
      </div>

      <div className="defile-x mt-6">
        <table className="tableau min-w-[540px]">
          <thead>
            <tr>
              <th>parfum</th>
              {elements.map((e) => <th key={cleElement(e)} className="num">
                {e.quantite > 1 ? `${e.quantite} × ` : ""}{options.find((o) => cleElement(o) === cleElement(e))?.nom ?? "indisponible"}
              </th>)}
              <th className="num"><Definition terme="coutPaquet">paquet complet</Definition></th>
            </tr>
          </thead>
          <tbody>
            {parfums.map((nom) => {
              const total = coutPaquet(elements, nom, produits, composants);
              return <tr key={nom}>
                <td>{nom}</td>
                {elements.map((e) => {
                  const cout = coutElement(e, nom, produits, composants);
                  return <td key={cleElement(e)} className="num tabulaire">{cout === null ? "—" : euro(cout)}</td>;
                })}
                <td className="num tabulaire">{total === null ? "—" : euro(total)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {elements.some((e) => e.type === "format" && parfums.some((nom) => !produits.some((p) => p.parfumNom === nom && p.formatId === e.formatId))) && (
        <p className="mt-2 text-[12px] text-lecture">— : ce format n’existe pas pour ce parfum ; le total ne peut pas être calculé.</p>
      )}
    </div>
  );
}
