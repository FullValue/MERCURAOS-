"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Decimal, dSaisie } from "@/lib/calcul/decimal";
import { moyennesRegistre } from "@/lib/calcul/registre";
import { horsTaxe } from "@/lib/calcul/cout";
import { euro } from "@/lib/format";
import { Definition } from "@/components/ui/Definition";
import type {
  CoutVariableLigne,
  EtatParametres,
  ValeurHistorisee,
} from "@/lib/donnees/parametres";
import {
  ajouterComposant,
  enregistrerParametres,
  supprimerComposant,
} from "@/app/(app)/parametres/actions";

interface CompEtat {
  formatId: string;
  formatLibelle: string;
  libelle: string;
  /** Libellé au chargement — sert à détecter les renommages. */
  libelleOriginal: string;
  coutUnitHT: string;
  optionnel: boolean;
  qteCommandee: string;
  tvaIncluse: boolean;
  faconnage: boolean;
  description: string;
  historique: ValeurHistorisee[];
}

function enEntier(texte: string): number | null {
  const n = Number(texte.replace(/\s/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}
interface FacEtat {
  produitId: string;
  parfumNom: string;
  formatId: string;
  formatLibelle: string;
  coutFixeSerie: string;
  coutVarUnitHT: string;
  qteLotRef: string;
}


function Historique({ liste }: { liste: ValeurHistorisee[] }) {
  if (liste.length <= 1) return null;
  return (
    <details className="mt-1">
      <summary className="lien-discret list-none">historique</summary>
      <ul className="mt-1">
        {liste.map((h, i) => (
          <li key={i} className="etiquette">
            {new Intl.DateTimeFormat("fr-FR").format(new Date(h.dateEffet))} — {h.valeur}
          </li>
        ))}
      </ul>
    </details>
  );
}

interface PrixEtat {
  produitId: string;
  formatId: string;
  formatLibelle: string;
  parfumId: string;
  parfumNom: string;
  prixLitreHT: string;
  litresCommandes: string;
  tvaIncluse: boolean;
  historique: ValeurHistorisee[];
}

/** Sélecteur compact HT / TTC. */
function ChoixTaxe({
  ttc,
  onChange,
  label,
}: {
  ttc: boolean;
  onChange: (ttc: boolean) => void;
  label: string;
}) {
  return (
    <select
      className="champ h-[30px] w-[72px] px-1 text-[13px]"
      value={ttc ? "TTC" : "HT"}
      onChange={(e) => onChange(e.target.value === "TTC")}
      aria-label={label}
    >
      <option value="HT">HT</option>
      <option value="TTC">TTC</option>
    </select>
  );
}

export function ParametresEditeur({
  etat,
  periodeId,
  coutsVariables = [],
}: {
  etat: EtatParametres;
  /** Période (commande fournisseur) dans laquelle dater les modifications. */
  periodeId?: string;
  /** Coûts variables de la période — comptés dans le total de la commande. */
  coutsVariables?: CoutVariableLigne[];
}) {
  const router = useRouter();
  const [taux, setTaux] = useState(etat.tauxPerte);
  const [livraison, setLivraison] = useState(etat.fraisLivraison);
  const [livTtc, setLivTtc] = useState(etat.fraisLivraisonTtc);
  const [nbPieces, setNbPieces] = useState(etat.livraisonNbPieces);
  const [tvaRecup, setTvaRecup] = useState(etat.tvaRecuperable);
  const [prixLiq, setPrixLiq] = useState<PrixEtat[]>(etat.prixLiquides);
  const [comps, setComps] = useState<CompEtat[]>(
    etat.composants.map((c) => ({ ...c, libelleOriginal: c.libelle })),
  );
  // Formulaire « + ajouter une ligne » : un seul ouvert à la fois, par format.
  const [ajoutFormatId, setAjoutFormatId] = useState<string | null>(null);
  const [ajoutLibelle, setAjoutLibelle] = useState("");
  const [ajoutCout, setAjoutCout] = useState("");
  const [ajoutOptionnel, setAjoutOptionnel] = useState(false);
  const [ajoutFaconnage, setAjoutFaconnage] = useState(false);
  // Formulaire d'ajout du bloc Sacs & options (optionnel d'office).
  // Un sac est unique (pas de déclinaison par format) : rattachement technique
  // au premier format, sans incidence (jamais compté dans le coût complet).
  const [sacAjoutOuvert, setSacAjoutOuvert] = useState(false);
  const sacFormatId = etat.formats[0]?.id ?? "";
  const [facs, setFacs] = useState<FacEtat[]>(
    etat.produits.map((produit) => {
      const courant = etat.faconnages.find((f) => f.produitId === produit.id);
      return courant ? { ...courant, qteLotRef: String(courant.qteLotRef) } : {
        produitId: produit.id, parfumNom: produit.parfumNom, formatId: produit.formatId, formatLibelle: produit.formatLibelle,
        coutFixeSerie: "", coutVarUnitHT: "", qteLotRef: "",
      };
    }),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Réconcilie l'état local après un ajout ou une suppression de ligne
  // (router.refresh renvoie de nouvelles props sans remonter le composant) :
  // les lignes serveur inconnues apparaissent, les supprimées disparaissent,
  // les modifications locales non enregistrées sont conservées.
  useEffect(() => {
    setComps((prev) => {
      const locaux = new Map(prev.map((c) => [`${c.formatId}|${c.libelleOriginal}`, c]));
      return etat.composants.map((c) => {
        const local = locaux.get(`${c.formatId}|${c.libelle}`);
        return local ?? { ...c, libelleOriginal: c.libelle };
      });
    });
    setPrixLiq((prev) => {
      const locaux = new Map(prev.map((x) => [x.produitId, x]));
      return etat.prixLiquides.map((x) => locaux.get(x.produitId) ?? x);
    });
    setFacs((prev) => etat.produits.map((produit) => prev.find((f) => f.produitId === produit.id)
      ?? (() => { const f = etat.faconnages.find((x) => x.produitId === produit.id); return f ? { ...f, qteLotRef: String(f.qteLotRef) } : { produitId: produit.id, parfumNom: produit.parfumNom, formatId: produit.formatId, formatLibelle: produit.formatLibelle, coutFixeSerie: "", coutVarUnitHT: "", qteLotRef: "" }; })()));
     
  }, [etat.composants, etat.prixLiquides, etat.faconnages, etat.produits]);

  const setPrix = (i: number, valeur: string) =>
    setPrixLiq((prev) => prev.map((x, j) => (j === i ? { ...x, prixLitreHT: valeur } : x)));
  const setLitres = (i: number, valeur: string) =>
    setPrixLiq((prev) => prev.map((x, j) => (j === i ? { ...x, litresCommandes: valeur } : x)));
  const setPrixTva = (i: number, ttc: boolean) =>
    setPrixLiq((prev) => prev.map((x, j) => (j === i ? { ...x, tvaIncluse: ttc } : x)));

  const setComp = (i: number, valeur: string) =>
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, coutUnitHT: valeur } : c)));
  const setCompLibelle = (i: number, valeur: string) =>
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, libelle: valeur } : c)));
  const setCompQte = (i: number, valeur: string) =>
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, qteCommandee: valeur } : c)));
  const setCompTva = (i: number, ttc: boolean) =>
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, tvaIncluse: ttc } : c)));
  const setCompDescription = (i: number, valeur: string) =>
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, description: valeur } : c)));

  function ajouterLigne(formatId: string, optionnelForce?: boolean) {
    setMessage(null);
    demarrer(async () => {
      const r = await ajouterComposant({
        periodeId,
        formatId,
        libelle: ajoutLibelle,
        coutUnitHT: ajoutCout || "0",
        optionnel: optionnelForce ?? ajoutOptionnel,
        faconnage: !optionnelForce && ajoutFaconnage,
      });
      setMessage(r.message);
      if (r.ok) {
        setAjoutFormatId(null);
        setSacAjoutOuvert(false);
        setAjoutLibelle("");
        setAjoutCout("");
        setAjoutOptionnel(false);
        setAjoutFaconnage(false);
        router.refresh();
      }
    });
  }

  function supprimerLigne(formatId: string, libelle: string) {
    if (!window.confirm(`Supprimer la ligne « ${libelle} » et tout son historique ?`)) return;
    setMessage(null);
    demarrer(async () => {
      const r = await supprimerComposant({ formatId, libelle });
      setMessage(r.message);
      if (r.ok) router.refresh();
    });
  }

  const impacts = useMemo(() => {
    const avant = moyennesRegistre(etat);
    const apres = moyennesRegistre({ ...etat, tauxPerte: taux, fraisLivraison: livraison, fraisLivraisonTtc: livTtc, livraisonNbPieces: nbPieces, tvaRecuperable: tvaRecup, prixLiquides: prixLiq, composants: comps, coutsVariables, faconnages: facs.filter((f) => f.coutFixeSerie.trim() !== "" || f.coutVarUnitHT.trim() !== "").map((f) => ({ ...f, coutFixeSerie: f.coutFixeSerie.trim() || "0", coutVarUnitHT: f.coutVarUnitHT.trim() || "0", qteLotRef: Math.max(1, Number(f.qteLotRef) || 1) })) });
    return etat.formats.map((f) => ({ libelle: f.libelle, avant: avant.get(f.id)!, apres: apres.get(f.id)!, change: !avant.get(f.id)!.eq(apres.get(f.id)!) }));
  }, [etat, taux, livraison, livTtc, nbPieces, tvaRecup, prixLiq, comps, facs, coutsVariables]);

  function enregistrer() {
    setMessage(null);
    // Un formulaire « + ajouter une ligne » resté ouvert et rempli est soumis
    // aussi : appuyer sur Enregistrer ne doit jamais perdre une saisie.
    if ((ajoutFormatId || sacAjoutOuvert) && ajoutLibelle.trim()) {
      ajouterLigne(sacAjoutOuvert ? sacFormatId : ajoutFormatId!, sacAjoutOuvert);
    }
    // Diffs uniquement.
    const tauxPerte = taux !== etat.tauxPerte ? taux : undefined;
    const fraisLivraison =
      livraison !== etat.fraisLivraison ? livraison.trim() || "0" : undefined;
    const fraisLivraisonTtc = livTtc !== etat.fraisLivraisonTtc ? livTtc : undefined;
    const livraisonNbPieces =
      nbPieces !== etat.livraisonNbPieces
        ? nbPieces.trim() === ""
          ? null
          : enEntier(nbPieces)
        : undefined;
    const tvaRecuperable = tvaRecup !== etat.tvaRecuperable ? tvaRecup : undefined;
    const prixLiquidesDiff = prixLiq
      .filter((x) => {
        const o = etat.prixLiquides.find((y) => y.produitId === x.produitId);
        return (
          o && x.prixLitreHT.trim() !== "" &&
          (o.prixLitreHT !== x.prixLitreHT ||
            o.litresCommandes !== x.litresCommandes ||
            o.tvaIncluse !== x.tvaIncluse)
        );
      })
      .map((x) => ({
        produitId: x.produitId,
        prixLitreHT: x.prixLitreHT,
        litresCommandes: x.litresCommandes.trim() === "" ? null : x.litresCommandes,
        tvaIncluse: x.tvaIncluse,
      }));
    const renommages = comps
      .filter((c) => c.libelle.trim() !== "" && c.libelle !== c.libelleOriginal)
      .map((c) => ({
        formatId: c.formatId,
        ancienLibelle: c.libelleOriginal,
        nouveauLibelle: c.libelle.trim(),
      }));
    const composantsDiff = comps
      .filter((c) => {
        const o = etat.composants.find(
          (x) => x.formatId === c.formatId && x.libelle === c.libelleOriginal,
        );
        return (
          o &&
          (o.coutUnitHT !== c.coutUnitHT ||
            o.qteCommandee !== c.qteCommandee ||
            o.tvaIncluse !== c.tvaIncluse ||
            o.faconnage !== c.faconnage ||
            o.description !== c.description)
        );
      })
      .map((c) => ({
        formatId: c.formatId,
        libelle: c.libelle.trim() || c.libelleOriginal,
        coutUnitHT: c.coutUnitHT,
        qteCommandee: c.qteCommandee.trim() === "" ? null : enEntier(c.qteCommandee),
        tvaIncluse: c.tvaIncluse,
        faconnage: c.faconnage,
        description: c.description.trim() === "" ? null : c.description,
      }));
    const faconnagesDiff = facs
      .filter((f) => {
        const o = etat.faconnages.find((x) => x.produitId === f.produitId);
        return (
          (!o && (f.coutFixeSerie.trim() !== "" || f.coutVarUnitHT.trim() !== "")) ||
          (o &&
          (o.coutFixeSerie !== f.coutFixeSerie ||
            o.coutVarUnitHT !== f.coutVarUnitHT ||
            String(o.qteLotRef) !== f.qteLotRef))
        );
      })
      .map((f) => ({
        produitId: f.produitId,
        coutFixeSerie: f.coutFixeSerie.trim() || "0",
        coutVarUnitHT: f.coutVarUnitHT.trim() || "0",
        qteLotRef: Number(f.qteLotRef) || 1,
      }));

    if (
      !tauxPerte &&
      !fraisLivraison &&
      fraisLivraisonTtc === undefined &&
      livraisonNbPieces === undefined &&
      tvaRecuperable === undefined &&
      prixLiquidesDiff.length === 0 &&
      composantsDiff.length === 0 &&
      renommages.length === 0 &&
      faconnagesDiff.length === 0
    ) {
      setMessage("Aucune modification.");
      return;
    }
    demarrer(async () => {
      const r = await enregistrerParametres({
        periodeId,
        tauxPerte,
        fraisLivraison,
        fraisLivraisonTtc,
        livraisonNbPieces,
        tvaRecuperable,
        prixLiquides: prixLiquidesDiff,
        composants: composantsDiff,
        renommages,
        faconnages: faconnagesDiff,
      });
      setMessage(r.message);
    });
  }

  const compsParFormat = etat.formats.map((f) => ({
    format: f,
    lignes: comps
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.formatId === f.id && !c.optionnel)
      .sort((a, b) => Number(a.c.faconnage) - Number(b.c.faconnage)),
  }));
  const sacs = comps.map((c, i) => ({ c, i })).filter(({ c }) => c.optionnel);

  return (
    <div className="pb-24">
      {/* Bloc 1 — taux de perte */}
      <section>
        <h2 className="font-titre text-[24px] font-light text-encre">
          <Definition terme="tauxPerte">Taux de perte</Definition>
        </h2>
        <div className="mt-4 flex items-baseline gap-3">
          <input
            className="valeur-editable"
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            aria-label="taux de perte"
          />
          <span className="etiquette">
            fraction (ex. 0,111 = {dSaisie(taux).mul(100).toFixed(1)} %)
          </span>
        </div>
        <Historique liste={etat.tauxPerteHistorique} />
      </section>

      {/* Bloc 1 bis — prix du liquide par parfum */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          <Definition terme="prixLiquide">Prix du liquide par parfum</Definition>
        </h2>
        <p className="mt-1 text-[13px] text-lecture">€ HT par litre. Une saisie distincte pour chaque parfum et chaque format.</p>
        <table className="tableau mt-4 max-w-[620px]">
          <thead>
            <tr>
              <th>parfum</th>
              <th className="num">prix / litre</th>
              <th>
                <Definition terme="htTtc">HT / TTC</Definition>
              </th>
              <th className="num">litres commandés</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {prixLiq.map((x, i) => (
              <tr key={x.produitId}>
                <td>{x.parfumNom} · {x.formatLibelle}</td>
                <td className="num">
                  <input
                    className="valeur-editable"
                    inputMode="decimal"
                    value={x.prixLitreHT}
                    onChange={(e) => setPrix(i, e.target.value)}
                    aria-label={`prix du liquide ${x.parfumNom} ${x.formatLibelle}`}
                    placeholder="—"
                  />
                </td>
                <td>
                  <ChoixTaxe
                    ttc={x.tvaIncluse}
                    onChange={(v) => setPrixTva(i, v)}
                    label={`TVA prix du liquide ${x.parfumNom} ${x.formatLibelle}`}
                  />
                </td>
                <td className="num">
                  <input
                    className="valeur-editable"
                    inputMode="decimal"
                    value={x.litresCommandes}
                    onChange={(e) => setLitres(i, e.target.value)}
                    placeholder="—"
                    aria-label={`litres commandés ${x.parfumNom} ${x.formatLibelle}`}
                  />
                </td>
                <td>
                  <Historique liste={x.historique} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre"><Definition terme="faconnage">Façonnage</Definition></h2>
        <p className="mt-1 text-[13px] text-lecture">Coût fixe de série réparti sur le lot, plus coût variable par unité. Chaque parfum et chaque format ont leur propre ligne. Les lignes de composants classées en façonnage s&apos;ajoutent à ce poste.</p>
        <div className="mt-5 flex flex-col gap-5">
          {facs.map((f, i) => <div key={f.produitId} className="flex flex-wrap items-end gap-4 border-b border-filet pb-5">
            <span className="w-[190px] text-[15px]">{f.parfumNom} · {f.formatLibelle}</span>
            {([ ["coutFixeSerie", "coût fixe / série"], ["coutVarUnitHT", "coût variable / unité"], ["qteLotRef", "quantité de lot"] ] as const).map(([cle, libelle]) =>
              <label key={cle} className="etiquette flex flex-col gap-1">{libelle}<input className="champ w-[150px]" inputMode={cle === "qteLotRef" ? "numeric" : "decimal"} value={f[cle]} onChange={(e) => setFacs((prev) => prev.map((item, j) => j === i ? { ...item, [cle]: e.target.value } : item))} /></label>
            )}
          </div>)}
        </div>
      </section>

      {/* Bloc 2 — composants par format */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          <Definition terme="conditionnement">Composants</Definition>
        </h2>
        {compsParFormat.map(({ format, lignes }) => (
          <div key={format.id} className="mt-6">
            <span className="etiquette">{format.libelle}</span>
            <table className="tableau mt-2 max-w-[660px]">
              <thead>
                <tr>
                  <th>composant</th>
                  <th className="num">coût unitaire</th>
                  <th>
                    <Definition terme="htTtc">HT / TTC</Definition>
                  </th>
                  <th className="num">qté commandée</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ c, i }) => (
                  <tr
                    key={`${c.formatId}-${c.libelleOriginal}`}
                    className={c.faconnage ? "ligne-faconnage" : undefined}
                  >
                    <td>
                      <input
                        className="valeur-editable w-[190px] text-left"
                        value={c.libelle}
                        onChange={(e) => setCompLibelle(i, e.target.value)}
                        aria-label={`libellé du composant ${c.libelleOriginal} ${format.libelle}`}
                      />
                      {c.faconnage && (
                        <span className="flex items-baseline text-[12px]" style={{ opacity: 0.75 }}>
                          (
                          <input
                            className="valeur-editable w-[230px] text-left text-[12px]"
                            value={c.description}
                            onChange={(e) => setCompDescription(i, e.target.value)}
                            placeholder="Blistage + mise en bouteille + sertissage"
                            aria-label={`description des coûts de façonnage ${format.libelle}`}
                          />
                          )
                        </span>
                      )}
                      <label className="etiquette mt-1 flex items-center gap-2"><input type="checkbox" checked={c.faconnage} onChange={(e) => setComps((prev) => prev.map((item, j) => j === i ? { ...item, faconnage: e.target.checked } : item))} />façonnage</label>
                    </td>
                    <td className="num">
                      <input
                        className="valeur-editable"
                        inputMode="decimal"
                        value={c.coutUnitHT}
                        onChange={(e) => setComp(i, e.target.value)}
                        aria-label={`coût ${c.libelleOriginal} ${format.libelle}`}
                      />
                    </td>
                    <td>
                      <ChoixTaxe
                        ttc={c.tvaIncluse}
                        onChange={(v) => setCompTva(i, v)}
                        label={`TVA ${c.libelleOriginal} ${format.libelle}`}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="valeur-editable"
                        inputMode="numeric"
                        value={c.qteCommandee}
                        onChange={(e) => setCompQte(i, e.target.value)}
                        placeholder="—"
                        aria-label={`quantité commandée ${c.libelleOriginal} ${format.libelle}`}
                      />
                    </td>
                    <td>
                      <div className="flex items-baseline gap-3">
                        <Historique liste={c.historique} />
                        <button
                          type="button"
                          className="lien-discret"
                          disabled={enCours}
                          onClick={() => supprimerLigne(c.formatId, c.libelleOriginal)}
                        >
                          supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ajoutFormatId === format.id ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="etiquette">libellé</span>
                  <input
                    className="champ w-[200px]"
                    value={ajoutLibelle}
                    onChange={(e) => setAjoutLibelle(e.target.value)}
                    placeholder="Étiquette sous flacon…"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiquette">coût unitaire HT</span>
                  <input
                    className="champ w-[110px] text-right"
                    inputMode="decimal"
                    value={ajoutCout}
                    onChange={(e) => setAjoutCout(e.target.value)}
                    placeholder="0,00"
                  />
                </label>
                <button
                  type="button"
                  className="bouton-plein"
                  disabled={enCours || !ajoutLibelle.trim()}
                  onClick={() => ajouterLigne(format.id)}
                >
                  {enCours ? "Ajout…" : "Ajouter"}
                </button>
                <label className="etiquette flex items-center gap-2 pb-2"><input type="checkbox" checked={ajoutFaconnage} onChange={(e) => setAjoutFaconnage(e.target.checked)} />classer en façonnage</label>
                <button
                  type="button"
                  className="lien-discret pb-2"
                  onClick={() => setAjoutFormatId(null)}
                >
                  annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="lien-discret mt-3"
                onClick={() => {
                  setAjoutFormatId(format.id);
                  setAjoutLibelle("");
                  setAjoutCout("");
                  setAjoutOptionnel(false);
                }}
              >
                + ajouter une ligne
              </button>
            )}
          </div>
        ))}
      </section>

      {/* Bloc 2 bis — sacs et options (composants optionnels, hors coût complet) */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Sacs &amp; options
        </h2>
        <p className="mt-1 text-[13px] text-lecture">
          Composants optionnels : jamais comptés dans le coût complet, ajoutés en
          charge de commande quand ils sont utilisés.
        </p>
        <table className="tableau mt-4 max-w-[620px]">
          <thead>
            <tr>
              <th>option</th>
              <th className="num">coût unitaire</th>
              <th>
                <Definition terme="htTtc">HT / TTC</Definition>
              </th>
              <th className="num">qté commandée</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sacs.map(({ c, i }) => (
              <tr key={`${c.formatId}-${c.libelleOriginal}`}>
                <td>
                  <input
                    className="valeur-editable w-[160px] text-left"
                    value={c.libelle}
                    onChange={(e) => setCompLibelle(i, e.target.value)}
                    aria-label={`libellé de l'option ${c.libelleOriginal}`}
                  />
                </td>
                <td className="num">
                  <input
                    className="valeur-editable"
                    inputMode="decimal"
                    value={c.coutUnitHT}
                    onChange={(e) => setComp(i, e.target.value)}
                    aria-label={`coût ${c.libelleOriginal} ${c.formatLibelle}`}
                  />
                </td>
                <td>
                  <ChoixTaxe
                    ttc={c.tvaIncluse}
                    onChange={(v) => setCompTva(i, v)}
                    label={`TVA ${c.libelleOriginal}`}
                  />
                </td>
                <td className="num">
                  <input
                    className="valeur-editable"
                    inputMode="numeric"
                    value={c.qteCommandee}
                    onChange={(e) => setCompQte(i, e.target.value)}
                    placeholder="—"
                    aria-label={`quantité commandée ${c.libelleOriginal} ${c.formatLibelle}`}
                  />
                </td>
                <td>
                  <div className="flex items-baseline gap-3">
                    <Historique liste={c.historique} />
                    <button
                      type="button"
                      className="lien-discret"
                      disabled={enCours}
                      onClick={() => supprimerLigne(c.formatId, c.libelleOriginal)}
                    >
                      supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sacAjoutOuvert ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="etiquette">libellé</span>
              <input
                className="champ w-[180px]"
                value={ajoutLibelle}
                onChange={(e) => setAjoutLibelle(e.target.value)}
                placeholder="Sac coton, ruban…"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="etiquette">coût unitaire HT</span>
              <input
                className="champ w-[110px] text-right"
                inputMode="decimal"
                value={ajoutCout}
                onChange={(e) => setAjoutCout(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <button
              type="button"
              className="bouton-plein"
              disabled={enCours || !ajoutLibelle.trim() || !sacFormatId}
              onClick={() => ajouterLigne(sacFormatId, true)}
            >
              {enCours ? "Ajout…" : "Ajouter"}
            </button>
            <button
              type="button"
              className="lien-discret pb-2"
              onClick={() => setSacAjoutOuvert(false)}
            >
              annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="lien-discret mt-3"
            onClick={() => {
              setSacAjoutOuvert(true);
              setAjoutFormatId(null);
              setAjoutLibelle("");
              setAjoutCout("");
            }}
          >
            + ajouter un sac ou une option
          </button>
        )}
      </section>

      {/* Bloc 4 — frais de livraison (facultatif) */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          <Definition terme="fraisLivraison">Frais de livraison</Definition>
        </h2>
        <p className="mt-1 text-[13px] text-lecture">
          Facultatif. Le montant est réparti sur le nombre de pièces livrées par
          la commande. Laisser vide pour ne rien compter.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="etiquette">montant / commande fournisseur</span>
            <input
              className="valeur-editable"
              inputMode="decimal"
              value={livraison}
              onChange={(e) => setLivraison(e.target.value)}
              placeholder="—"
              aria-label="frais de livraison par commande fournisseur"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="etiquette">
              <Definition terme="htTtc">HT / TTC</Definition>
            </span>
            <ChoixTaxe ttc={livTtc} onChange={setLivTtc} label="TVA frais de livraison" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="etiquette">nombre de pièces livrées</span>
            <input
              className="valeur-editable"
              inputMode="numeric"
              value={nbPieces}
              onChange={(e) => setNbPieces(e.target.value)}
              placeholder="—"
              aria-label="nombre de pièces livrées par la commande"
            />
          </label>
        </div>
        {dSaisie(livraison).gt(0) && (
          <p className="mt-2 text-[13px] text-lecture">
            soit{" "}
            <span className="tabulaire text-encre">
              {euro(
                horsTaxe(dSaisie(livraison), livTtc && tvaRecup).div(
                  dSaisie(nbPieces).gt(0)
                    ? dSaisie(nbPieces)
                    : new Decimal(Math.max(1, Number(facs[0]?.qteLotRef ?? 1))),
                ),
              )}
            </span>{" "}
            HT par pièce
            {dSaisie(nbPieces).lte(0) && " (sur la quantité de lot en repli : renseignez le nombre de pièces)"}
            .
          </p>
        )}
        <Historique liste={etat.fraisLivraisonHistorique} />
      </section>

      {/* Récapitulatif de la commande fournisseur (quantités × prix, en HT) */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          <Definition terme="totalCommande">Total de la commande</Definition>
        </h2>
        <label className="mt-3 flex flex-wrap items-center gap-3">
          <span className="etiquette">
            <Definition terme="htTtc">TVA récupérable</Definition>
          </span>
          <select
            className="champ h-[30px] w-[76px] px-1 text-[13px]"
            value={tvaRecup ? "oui" : "non"}
            onChange={(e) => setTvaRecup(e.target.value === "oui")}
            aria-label="TVA récupérable"
          >
            <option value="oui">oui</option>
            <option value="non">non</option>
          </select>
          <span className="text-[13px] text-lecture">
            {tvaRecup
              ? "les montants TTC sont ramenés en HT dans les coûts (÷ 1,20)."
              : "franchise de TVA : les montants TTC comptent en entier dans les coûts."}
          </span>
        </label>
        {(() => {
          // Deux lectures : le montant PAYÉ (tel que saisi, TTC ou HT selon la
          // ligne — comparable aux factures) et le montant HT RETENU (base des
          // coûts : les montants TTC sont divisés par 1,20).
          const zero = new Decimal(0);
          const ht = (montant: Decimal, ttc: boolean) =>
            horsTaxe(montant, ttc && tvaRecup);
          const liquidesPaye = prixLiq.reduce(
            (acc, x) => acc.plus(dSaisie(x.prixLitreHT).mul(dSaisie(x.litresCommandes))),
            zero,
          );
          const liquidesHT = prixLiq.reduce(
            (acc, x) =>
              acc.plus(
                ht(dSaisie(x.prixLitreHT), x.tvaIncluse).mul(dSaisie(x.litresCommandes)),
              ),
            zero,
          );
          const composantsPaye = comps.reduce(
            (acc, c) => acc.plus(dSaisie(c.coutUnitHT).mul(dSaisie(c.qteCommandee))),
            zero,
          );
          const composantsHT = comps.reduce(
            (acc, c) =>
              acc.plus(
                ht(dSaisie(c.coutUnitHT), c.tvaIncluse).mul(dSaisie(c.qteCommandee)),
              ),
            zero,
          );
          const livraisonPaye = dSaisie(livraison);
          const livraisonHT = ht(livraisonPaye, livTtc);
          const variablesPaye = coutsVariables.reduce(
            (acc, c) => acc.plus(dSaisie(c.montant)),
            zero,
          );
          const variablesHT = coutsVariables.reduce(
            (acc, c) => acc.plus(ht(dSaisie(c.montant), c.tvaIncluse)),
            zero,
          );
          const totalPaye = liquidesPaye.plus(composantsPaye).plus(livraisonPaye).plus(variablesPaye);
          const totalHT = liquidesHT.plus(composantsHT).plus(livraisonHT).plus(variablesHT);
          return (
            <table className="tableau mt-4 max-w-[560px]">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">payé (tel que saisi)</th>
                  <th className="num">
                    <Definition terme="htTtc">{tvaRecup ? "HT retenu" : "retenu (TTC compris)"}</Definition>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>liquides (litres × prix)</td>
                  <td className="num tabulaire">{euro(liquidesPaye)}</td>
                  <td className="num tabulaire">{euro(liquidesHT)}</td>
                </tr>
                <tr>
                  <td>composants et options (qté × coût)</td>
                  <td className="num tabulaire">{euro(composantsPaye)}</td>
                  <td className="num tabulaire">{euro(composantsHT)}</td>
                </tr>
                <tr>
                  <td>livraison</td>
                  <td className="num tabulaire">{euro(livraisonPaye)}</td>
                  <td className="num tabulaire">{euro(livraisonHT)}</td>
                </tr>
                <tr>
                  <td>coûts variables (douane, transitaire…)</td>
                  <td className="num tabulaire">{euro(variablesPaye)}</td>
                  <td className="num tabulaire">{euro(variablesHT)}</td>
                </tr>
                <tr className="total">
                  <td>total</td>
                  <td className="num tabulaire">{euro(totalPaye)}</td>
                  <td className="num tabulaire">{euro(totalHT)}</td>
                </tr>
              </tbody>
            </table>
          );
        })()}
        <p className="mt-2 text-[13px] text-lecture">
          «&nbsp;Payé&nbsp;» = vos saisies telles quelles (à rapprocher des
          factures). «&nbsp;Retenu&nbsp;» = la base des calculs de coûts : si la
          TVA est récupérable, les montants marqués TTC sont ramenés hors taxes
          (÷&nbsp;1,20) ; sinon ils comptent en entier. Repère d&apos;achat :
          n&apos;entre pas dans le coût de revient unitaire. Pensez à
          Enregistrer après un changement du réglage TVA.
        </p>
      </section>

      {/* Bande d'impact en direct */}
      <div className="bande-impact">
        {impacts.map((im) => (
          <span key={im.libelle} className="text-[13px] text-lecture">
            <Definition terme="coutComplet">coût complet moyen</Definition> {im.libelle} :{" "}
            <span className="tabulaire text-encre">{euro(im.avant)}</span>
            {im.change && (
              <>
                {" → "}
                <span className="tabulaire text-encre">{euro(im.apres)}</span>
              </>
            )}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-4">
          {message && <span className="text-[13px] text-lecture">{message}</span>}
          <button className="bouton-plein" onClick={enregistrer} disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </span>
      </div>
    </div>
  );
}
