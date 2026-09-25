"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterTranche,
  modifierTranches,
  supprimerReference,
  supprimerTranche,
} from "@/app/(app)/grille-tarifaire/actions";
import { Definition } from "@/components/ui/Definition";

export interface TrancheLigne {
  id: string;
  role: string;
  libelle: string;
  qteMin: string;
  qteMax: string; // "" = et au-delà
  prixUnitHT: string;
  notes: string;
}

const ROLES_AFFICHES: { role: string; titre: string }[] = [
  { role: "DISTRIBUTEUR", titre: "Distributeurs" },
  { role: "REVENDEUR", titre: "Revendeurs" },
];

function enEntier(texte: string): number | null {
  const n = Number.parseInt(texte.replace(/\s/g, ""), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function tranchePayload(l: Omit<TrancheLigne, "id">) {
  return {
    role: l.role as "DISTRIBUTEUR" | "REVENDEUR" | "CORNER" | "D2C" | "PROSPECT",
    libelle: l.libelle,
    qteMin: enEntier(l.qteMin) ?? 0,
    qteMax: l.qteMax.trim() === "" ? null : enEntier(l.qteMax),
    prixUnitHT: l.prixUnitHT,
    notes: l.notes.trim() === "" ? null : l.notes,
  };
}

export function GrilleTarifaireEditeur({ tranches }: { tranches: TrancheLigne[] }) {
  const router = useRouter();
  const [lignes, setLignes] = useState<TrancheLigne[]>(tranches);
  const [ajoutRole, setAjoutRole] = useState<string | null>(null);
  const [nLibelle, setNLibelle] = useState("");
  const [nQteMin, setNQteMin] = useState("");
  const [nQteMax, setNQteMax] = useState("");
  const [nPrix, setNPrix] = useState("");
  const [nNotes, setNNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Réconcilie l'état local quand le serveur renvoie de nouvelles données
  // (après ajout/suppression) : les lignes ajoutées apparaissent, les
  // supprimées disparaissent, les modifications locales non enregistrées
  // sont conservées.
  useEffect(() => {
    setLignes((prev) => {
      const locaux = new Map(prev.map((l) => [l.id, l]));
      return tranches.map((t) => locaux.get(t.id) ?? t);
    });
  }, [tranches]);

  const modifier = (id: string, champ: keyof TrancheLigne, valeur: string) =>
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));

  function ajouter(role: string) {
    setMessage(null);
    demarrer(async () => {
      const r = await ajouterTranche(
        tranchePayload({
          role,
          libelle: nLibelle,
          qteMin: nQteMin,
          qteMax: nQteMax,
          prixUnitHT: nPrix,
          notes: nNotes,
        }),
      );
      setMessage(r.message);
      if (r.ok) {
        // Le formulaire reste ouvert pour enchaîner les tranches : même
        // référence, borne basse pré-remplie à la suite de la précédente.
        const suivant = enEntier(nQteMax);
        setNQteMin(suivant !== null ? String(suivant + 1) : "");
        setNQteMax("");
        setNPrix("");
        setNNotes("");
        router.refresh();
      }
    });
  }

  function supprimer(id: string, libelle: string) {
    if (!window.confirm(`Supprimer la tranche « ${libelle} » ?`)) return;
    setMessage(null);
    demarrer(async () => {
      const r = await supprimerTranche({ id });
      setMessage(r.message);
      if (r.ok) {
        setLignes((prev) => prev.filter((l) => l.id !== id));
        router.refresh();
      }
    });
  }

  function supprimerGroupe(role: string, libelle: string, nb: number) {
    if (!window.confirm(`Supprimer la référence « ${libelle} » et ses ${nb} tranches ?`)) return;
    setMessage(null);
    demarrer(async () => {
      const r = await supprimerReference({
        role: role as "DISTRIBUTEUR" | "REVENDEUR" | "CORNER" | "D2C" | "PROSPECT",
        libelle,
      });
      setMessage(r.message);
      if (r.ok) {
        setLignes((prev) => prev.filter((l) => !(l.role === role && l.libelle === libelle)));
        router.refresh();
      }
    });
  }

  function enregistrer() {
    setMessage(null);
    const diffs = lignes.filter((l) => {
      const o = tranches.find((t) => t.id === l.id);
      return o && JSON.stringify(o) !== JSON.stringify(l);
    });
    if (diffs.length === 0) {
      setMessage("Aucune modification.");
      return;
    }
    demarrer(async () => {
      const r = await modifierTranches(
        diffs.map((l) => ({ id: l.id, ...tranchePayload(l) })),
      );
      setMessage(r.message);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="pb-24">
      {ROLES_AFFICHES.map(({ role, titre }) => {
        const duRole = lignes
          .filter((l) => l.role === role)
          .sort(
            (a, b) =>
              a.libelle.localeCompare(b.libelle, "fr") ||
              (enEntier(a.qteMin) ?? 0) - (enEntier(b.qteMin) ?? 0),
          );
        return (
          <section key={role} className="mt-12 first:mt-0 border-t border-filet pt-8 first:border-t-0 first:pt-0">
            <h2 className="font-titre text-[24px] font-light text-encre">{titre}</h2>

            {duRole.length === 0 ? (
              <p className="mt-3 text-[13px] text-lecture">
                Aucune tranche. Ajoutez la première ligne ci-dessous.
              </p>
            ) : (
              <table className="tableau mt-4">
                <thead>
                  <tr>
                    <th>référence</th>
                    <th className="num">de (qté)</th>
                    <th className="num">à (qté)</th>
                    <th className="num">
                      <Definition terme="prixCession">prix unitaire HT</Definition>
                    </th>
                    <th>notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {duRole.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <input
                          className="valeur-editable w-[180px] text-left"
                          value={l.libelle}
                          onChange={(e) => modifier(l.id, "libelle", e.target.value)}
                          aria-label={`référence ${l.libelle}`}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="valeur-editable w-[70px]"
                          inputMode="numeric"
                          value={l.qteMin}
                          onChange={(e) => modifier(l.id, "qteMin", e.target.value)}
                          aria-label={`quantité minimale ${l.libelle}`}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="valeur-editable w-[70px]"
                          inputMode="numeric"
                          value={l.qteMax}
                          onChange={(e) => modifier(l.id, "qteMax", e.target.value)}
                          placeholder="et +"
                          aria-label={`quantité maximale ${l.libelle}`}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="valeur-editable w-[90px]"
                          inputMode="decimal"
                          value={l.prixUnitHT}
                          onChange={(e) => modifier(l.id, "prixUnitHT", e.target.value)}
                          aria-label={`prix unitaire ${l.libelle}`}
                        />
                      </td>
                      <td>
                        <input
                          className="valeur-editable w-[200px] text-left"
                          value={l.notes}
                          onChange={(e) => modifier(l.id, "notes", e.target.value)}
                          placeholder="—"
                          aria-label={`notes ${l.libelle}`}
                        />
                      </td>
                      <td>
                        <span className="flex items-baseline gap-3">
                          <button
                            type="button"
                            className="lien-discret"
                            disabled={enCours}
                            onClick={() => supprimer(l.id, l.libelle)}
                          >
                            supprimer
                          </button>
                          {duRole.filter((x) => x.libelle === l.libelle).length > 1 &&
                            duRole.find((x) => x.libelle === l.libelle)?.id === l.id && (
                              <button
                                type="button"
                                className="lien-discret"
                                disabled={enCours}
                                onClick={() =>
                                  supprimerGroupe(
                                    role,
                                    l.libelle,
                                    duRole.filter((x) => x.libelle === l.libelle).length,
                                  )
                                }
                              >
                                toute la référence
                              </button>
                            )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {ajoutRole === role ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="etiquette">référence</span>
                  <input className="champ w-[180px]" value={nLibelle} onChange={(e) => setNLibelle(e.target.value)} placeholder="50 ml, coffret…" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiquette">de (qté)</span>
                  <input className="champ w-[90px] text-right" inputMode="numeric" value={nQteMin} onChange={(e) => setNQteMin(e.target.value)} placeholder="1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiquette">à (qté, vide = et +)</span>
                  <input className="champ w-[120px] text-right" inputMode="numeric" value={nQteMax} onChange={(e) => setNQteMax(e.target.value)} placeholder="—" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiquette">prix unitaire HT</span>
                  <input className="champ w-[110px] text-right" inputMode="decimal" value={nPrix} onChange={(e) => setNPrix(e.target.value)} placeholder="0,00" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiquette">notes</span>
                  <input className="champ w-[200px]" value={nNotes} onChange={(e) => setNNotes(e.target.value)} placeholder="franco, MOQ…" />
                </label>
                <button
                  type="button"
                  className="bouton-plein"
                  disabled={enCours || !nLibelle.trim() || !enEntier(nQteMin) || !nPrix.trim()}
                  onClick={() => ajouter(role)}
                >
                  {enCours ? "Ajout…" : "Ajouter"}
                </button>
                <button type="button" className="lien-discret pb-2" onClick={() => setAjoutRole(null)}>
                  fermer
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="lien-discret mt-4"
                onClick={() => {
                  setAjoutRole(role);
                  setMessage(null);
                }}
              >
                + ajouter une tranche
              </button>
            )}
          </section>
        );
      })}

      <div className="bande-impact">
        <button type="button" className="bouton-plein" disabled={enCours} onClick={enregistrer}>
          {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {message && <span className="text-[13px] text-lecture">{message}</span>}
      </div>
    </div>
  );
}
