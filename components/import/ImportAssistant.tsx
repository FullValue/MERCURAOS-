"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  CIBLES,
  type ChoixDoublon,
  type LignePrevisualisee,
  type Mapping,
  type TypeCible,
} from "@/lib/import/definitions";
import {
  appliquerImport,
  chargerDernierMapping,
  previsualiserImport,
} from "@/app/(app)/import/actions";

type Etape = "depot" | "mapping" | "previsualisation" | "applique";

export function ImportAssistant() {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>("depot");
  const [typeCible, setTypeCible] = useState<TypeCible>("composants");
  const [nomFichier, setNomFichier] = useState("");
  const [entetes, setEntetes] = useState<string[]>([]);
  const [lignesSource, setLignesSource] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [prev, setPrev] = useState<LignePrevisualisee[]>([]);
  const [choix, setChoix] = useState<Record<string, ChoixDoublon>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // ----- Étape 1 : dépôt -----
  async function lireFichier(fichier: File) {
    const data = await fichier.arrayBuffer();
    const classeur = XLSX.read(data);
    const feuille = classeur.Sheets[classeur.SheetNames[0]!];
    if (!feuille) {
      setMessage("Fichier vide.");
      return;
    }
    const brut = XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille, {
      raw: false,
      defval: "",
    });
    if (brut.length === 0) {
      setMessage("Aucune ligne de données.");
      return;
    }
    const colonnes = Object.keys(brut[0]!);
    setEntetes(colonnes);
    setLignesSource(
      brut.map((r) =>
        Object.fromEntries(colonnes.map((c) => [c, String(r[c] ?? "")])),
      ),
    );
    setNomFichier(fichier.name);
    setMessage(null);

    // Mapping par défaut : dernier mapping du même type, sinon rapprochement par nom.
    const dernier = await chargerDernierMapping(typeCible);
    const auto: Mapping = {};
    for (const champ of CIBLES[typeCible].champs) {
      const memorise = dernier
        ? Object.entries(dernier).find(([, v]) => v === champ.cle)?.[0]
        : undefined;
      if (memorise && colonnes.includes(memorise)) {
        auto[memorise] = champ.cle;
        continue;
      }
      const candidat = colonnes.find(
        (c) =>
          c.trim().toLowerCase() === champ.cle.toLowerCase() ||
          c.trim().toLowerCase() === champ.libelle.toLowerCase(),
      );
      if (candidat) auto[candidat] = champ.cle;
    }
    setMapping(auto);
    setEtape("mapping");
  }

  /** Modèle .xlsx généré à la volée par SheetJS (§9). */
  function telechargerModele(type: TypeCible) {
    const def = CIBLES[type];
    const entetesModele = def.champs.map((c) => c.libelle);
    const exemple = def.champs.map((c) => c.exemple);
    const feuille = XLSX.utils.aoa_to_sheet([entetesModele, exemple]);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, def.libelle);
    XLSX.writeFile(classeur, `modele-${type}.xlsx`);
  }

  // ----- Étape 2 → 3 : prévisualisation -----
  function projeter(): Record<string, string>[] {
    return lignesSource.map((ligne) => {
      const projetee: Record<string, string> = {};
      for (const [source, cible] of Object.entries(mapping)) {
        if (cible) projetee[cible] = ligne[source] ?? "";
      }
      return projetee;
    });
  }

  function lancerPrevisualisation() {
    setMessage(null);
    demarrer(async () => {
      const r = await previsualiserImport({ typeCible, lignes: projeter() });
      if (!r.ok) {
        setMessage(r.message ?? "Erreur.");
        return;
      }
      setPrev(r.lignes);
      setChoix({});
      setEtape("previsualisation");
    });
  }

  // ----- Étape 4 : application -----
  const erreursNonTraitees = prev.filter(
    (l) => l.statut === "erreur" && choix[String(l.index)] !== "ignorer",
  ).length;

  function lancerApplication() {
    setMessage(null);
    demarrer(async () => {
      const r = await appliquerImport({
        typeCible,
        nomFichier,
        mapping,
        lignes: projeter(),
        choix,
      });
      setMessage(r.message);
      if (r.ok) {
        setEtape("applique");
        router.refresh();
      }
    });
  }

  const champsRequis = CIBLES[typeCible].champs.filter((c) => c.requis);
  const champsMappes = new Set(Object.values(mapping));
  const mappingComplet = champsRequis.every((c) => champsMappes.has(c.cle));

  return (
    <div>
      {/* Étape 1 — dépôt */}
      {etape === "depot" && (
        <div>
          <div className="flex flex-wrap items-end gap-6">
            <label className="flex flex-col gap-2">
              <span className="etiquette">cible</span>
              <select
                className="champ w-[220px]"
                value={typeCible}
                onChange={(e) => setTypeCible(e.target.value as TypeCible)}
              >
                {Object.entries(CIBLES).map(([cle, def]) => (
                  <option key={cle} value={cle}>
                    {def.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="etiquette">fichier (.xlsx ou .csv)</span>
              <input
                type="file"
                accept=".xlsx,.csv,.xls"
                className="text-[13px]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void lireFichier(f);
                }}
              />
            </label>
          </div>
          <p className="mt-6 text-[13px] text-lecture">
            Modèles :{" "}
            {(Object.keys(CIBLES) as TypeCible[]).map((t, i) => (
              <span key={t}>
                {i > 0 && " · "}
                <button className="lien-discret" onClick={() => telechargerModele(t)}>
                  {CIBLES[t].libelle.toLowerCase()}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Étape 2 — mapping */}
      {etape === "mapping" && (
        <div>
          <p className="text-[13px] text-lecture">
            {nomFichier} — {lignesSource.length} ligne(s). Associez chaque en-tête
            détecté à un champ cible.
          </p>
          <table className="tableau mt-6 max-w-[560px]">
            <thead>
              <tr>
                <th>en-tête détecté</th>
                <th>champ cible</th>
              </tr>
            </thead>
            <tbody>
              {entetes.map((h) => (
                <tr key={h}>
                  <td>{h}</td>
                  <td>
                    <select
                      className="champ h-8 w-[240px]"
                      value={mapping[h] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [h]: e.target.value }))
                      }
                    >
                      <option value="">— ignorer —</option>
                      {CIBLES[typeCible].champs.map((c) => (
                        <option key={c.cle} value={c.cle}>
                          {c.libelle}
                          {c.requis ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex items-center gap-4">
            <button
              className="bouton-plein"
              disabled={!mappingComplet || enCours}
              onClick={lancerPrevisualisation}
            >
              {enCours ? "Analyse…" : "Prévisualiser"}
            </button>
            {!mappingComplet && (
              <span className="text-[13px] text-lecture">
                Champs requis non associés.
              </span>
            )}
            <button className="lien-discret" onClick={() => setEtape("depot")}>
              retour
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — prévisualisation */}
      {etape === "previsualisation" && (
        <div>
          <p className="text-[13px] text-lecture">
            {prev.filter((l) => l.statut === "ok").length} valide(s) ·{" "}
            {prev.filter((l) => l.statut === "doublon").length} doublon(s) ·{" "}
            {prev.filter((l) => l.statut === "erreur").length} en erreur
          </p>
          <div className="mt-6 max-h-[480px] overflow-y-auto border-b border-filet">
            <table className="tableau">
              <thead>
                <tr>
                  <th>#</th>
                  {CIBLES[typeCible].champs.map((c) => (
                    <th key={c.cle}>{c.libelle}</th>
                  ))}
                  <th>statut</th>
                  <th>action</th>
                </tr>
              </thead>
              <tbody>
                {prev.map((l) => (
                  <tr key={l.index}>
                    <td className="tabulaire">{l.index + 1}</td>
                    {CIBLES[typeCible].champs.map((c) => (
                      <td key={c.cle}>{l.valeurs[c.cle] ?? ""}</td>
                    ))}
                    <td>
                      {l.statut === "ok" && <span className="etiquette">valide</span>}
                      {l.statut === "doublon" && (
                        <span className="etiquette">doublon — {l.motif}</span>
                      )}
                      {l.statut === "erreur" && (
                        <span className="sous-seuil text-[13px]">{l.motif}</span>
                      )}
                    </td>
                    <td>
                      {l.statut === "doublon" && (
                        <select
                          className="champ h-8 w-[150px]"
                          value={choix[String(l.index)] ?? "ignorer"}
                          onChange={(e) =>
                            setChoix((prev) => ({
                              ...prev,
                              [String(l.index)]: e.target.value as ChoixDoublon,
                            }))
                          }
                        >
                          <option value="ignorer">ignorer</option>
                          <option value="maj">mettre à jour</option>
                          <option value="creer">créer</option>
                        </select>
                      )}
                      {l.statut === "erreur" && (
                        <label className="flex items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            checked={choix[String(l.index)] === "ignorer"}
                            onChange={(e) =>
                              setChoix((prev) => ({
                                ...prev,
                                [String(l.index)]: e.target.checked
                                  ? "ignorer"
                                  : ("" as ChoixDoublon),
                              }))
                            }
                          />
                          écarter la ligne
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button
              className="bouton-plein"
              disabled={erreursNonTraitees > 0 || enCours}
              onClick={lancerApplication}
            >
              {enCours ? "Application…" : "Appliquer l'import"}
            </button>
            {erreursNonTraitees > 0 && (
              <span className="text-[13px] text-lecture">
                {erreursNonTraitees} ligne(s) en erreur à traiter avant application.
              </span>
            )}
            <button className="lien-discret" onClick={() => setEtape("mapping")}>
              retour au mapping
            </button>
          </div>
        </div>
      )}

      {/* Étape 4 — appliqué */}
      {etape === "applique" && (
        <div>
          <p className="text-[15px]">{message}</p>
          <p className="mt-2 text-[13px] text-lecture">
            L'import est annulable depuis l'historique ci-dessous.
          </p>
          <button
            className="bouton-plein mt-6"
            onClick={() => {
              setEtape("depot");
              setPrev([]);
              setLignesSource([]);
              setMessage(null);
            }}
          >
            Nouvel import
          </button>
        </div>
      )}

      {message && etape !== "applique" && (
        <p className="mt-4 text-[13px] text-lecture">{message}</p>
      )}
    </div>
  );
}
