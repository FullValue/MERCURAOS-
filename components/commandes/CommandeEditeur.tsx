"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decompositionCout, valeurAuJour } from "@/lib/calcul";
import { dateValide } from "@/lib/validation";
import { ActionsCommande } from "./ActionsCommande";
import { Decimal, dSaisie } from "@/lib/calcul/decimal";
import { euro, pourcent, points } from "@/lib/format";
import { SEUIL_ALERTE_MARGE } from "@/lib/constantes";
import { Definition } from "@/components/ui/Definition";
import type {
  ClientPourCommande,
  DonneesEditeur,
  ProduitPourCommande,
} from "@/lib/donnees/commandes";
import { enregistrerCommande } from "@/app/(app)/commandes/actions";

interface LigneEtat {
  produitId: string;
  qte: string;
  puHT: string;
  offert: boolean;
}
interface ChargeEtat {
  libelle: string;
  montantHT: string;
}

export interface PeriodePourCommande {
  id: string;
  libelle: string;
  dateEffet: string; // ISO
}

interface Props {
  donnees: DonneesEditeur;
  /** Périodes de coûts disponibles + données produits calculées pour chacune. */
  periodes?: PeriodePourCommande[];
  donneesParPeriode?: Record<string, DonneesEditeur>;
  /** Période présélectionnée (commande existante). */
  initialPeriodeId?: string;
  commandeId?: string;
  initial?: {
    clientId: string;
    date: string; // yyyy-mm-dd
    notes: string;
    lignes: LigneEtat[];
    charges: ChargeEtat[];
  };
}

function coutUnitaire(p: ProduitPourCommande, qteLotFormat: number, date: Date): Decimal {
  return decompositionCout(p.contexte, date, { qteLot: Math.max(1, qteLotFormat) }).complet;
}

export function CommandeEditeur({
  donnees,
  periodes = [],
  donneesParPeriode = {},
  initialPeriodeId,
  commandeId,
  initial,
}: Props) {
  const router = useRouter();
  const [periodeId, setPeriodeId] = useState(
    initialPeriodeId ?? "",
  );
  // Jeu de données actif : celui de la période de coûts choisie.
  const jeu = (periodeId && donneesParPeriode[periodeId]) || donnees;
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lignes, setLignes] = useState<LigneEtat[]>(initial?.lignes ?? []);
  const [charges, setCharges] = useState<ChargeEtat[]>(initial?.charges ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const qteParFormatAffichage = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lignes) {
      const p = jeu.produits.find((x) => x.produitId === l.produitId);
      const q = (Number.isFinite(Number(l.qte)) ? Number(l.qte) : 0);
      if (p && q > 0) m.set(p.formatId, (m.get(p.formatId) ?? 0) + q);
    }
    return m;
  }, [lignes, jeu.produits]);

  const parProduit = useMemo(
    () => new Map(jeu.produits.map((p) => [p.produitId, p])),
    [jeu.produits],
  );
  const dateCalcul = useMemo(() => new Date(periodes.find((p) => p.id === periodeId)?.dateEffet ?? (dateValide(date) ? date : "1970-01-01")), [periodes, periodeId, date]);
  const clients = useMemo(() => jeu.clients.map((c): ClientPourCommande => {
    const grille: Record<string, string> = {};
    for (const p of jeu.produits) {
      const prix = valeurAuJour(c.historiqueGrille.filter((g) => g.produitId === p.produitId), new Date(dateValide(date) ? date : "1970-01-01"));
      if (prix) grille[p.produitId] = prix.prix;
    }
    return { ...c, grille };
  }), [jeu, date]);
  const client = clients.find((c) => c.id === clientId);

  function ajouterLigne() {
    const premier = jeu.produits[0];
    if (!premier) return;
    setLignes((prev) => [
      ...prev,
      {
        produitId: premier.produitId,
        qte: "1",
        puHT: client?.grille[premier.produitId] ?? "",
        offert: false,
      },
    ]);
  }

  function majLigne(i: number, maj: Partial<LigneEtat>) {
    setLignes((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...maj };
        // La grille tarifaire s'applique automatiquement au changement de produit (§8.6).
        if (maj.produitId) {
          next.puHT = client?.grille[maj.produitId] ?? "";
        }
        return next;
      }),
    );
  }

  // ----- Agrégats en direct (Decimal, arrondi à l'affichage) -----
  const calc = useMemo(() => {
    const qteParFormat = new Map<string, number>();
    for (const l of lignes) {
      const p = parProduit.get(l.produitId);
      const q = (Number.isFinite(Number(l.qte)) ? Number(l.qte) : 0);
      if (p && q > 0) qteParFormat.set(p.formatId, (qteParFormat.get(p.formatId) ?? 0) + q);
    }

    let ca = new Decimal(0);
    let cout = new Decimal(0);
    let coutGamme = new Decimal(0);
    const coutParFormat = new Map<string, Decimal>();

    for (const l of lignes) {
      const p = parProduit.get(l.produitId);
      const q = (Number.isFinite(Number(l.qte)) ? Number(l.qte) : 0);
      if (!p || q <= 0) continue;
      const lot = qteParFormat.get(p.formatId) ?? 0;
      const coutLigne = coutUnitaire(p, lot, dateCalcul).mul(q);
      cout = cout.plus(coutLigne);
      coutParFormat.set(
        p.formatLibelle,
        (coutParFormat.get(p.formatLibelle) ?? new Decimal(0)).plus(coutLigne),
      );
      if (!l.offert) ca = ca.plus(dSaisie(l.puHT).mul(q));

      // Repère : coût moyen de gamme du format au même lot (affichage seulement).
      const gamme = jeu.produits.filter((x) => x.formatId === p.formatId);
      const moyenne = gamme
        .reduce((acc, x) => acc.plus(coutUnitaire(x, lot, dateCalcul)), new Decimal(0))
        .div(gamme.length || 1);
      coutGamme = coutGamme.plus(moyenne.mul(q));
    }

    const totalCharges = charges.reduce(
      (acc, c) => acc.plus(dSaisie(c.montantHT)),
      new Decimal(0),
    );
    const margeBrute = ca.minus(cout);
    const margeNette = margeBrute.minus(totalCharges);
    const taux = ca.isZero() ? null : margeBrute.div(ca);
    const tauxGamme = ca.isZero() ? null : ca.minus(coutGamme).div(ca);

    return { ca, cout, coutParFormat, totalCharges, margeBrute, margeNette, taux, tauxGamme };
  }, [lignes, charges, parProduit, jeu.produits, dateCalcul]);

  const sousSeuil = calc.taux !== null && calc.taux.lt(SEUIL_ALERTE_MARGE);

  async function sauvegarder() {
    const periode = periodes.find((x) => x.id === periodeId);
    return enregistrerCommande({
      commandeId, clientId, date, dateCouts: periode?.dateEffet, notes,
      lignes: lignes.map((l) => ({ produitId: l.produitId, qte: Number(l.qte), puHT: l.offert ? "0" : l.puHT, offert: l.offert })),
      charges: charges.filter((c) => c.libelle.trim() || c.montantHT.trim()),
    });
  }
  function enregistrer() {
    setMessage(null);
    demarrer(async () => {
      try {
        const r = await sauvegarder();
        setMessage(r.message);
        if (r.ok && r.id) { router.push(`/commandes/${r.id}`); router.refresh(); }
      } catch { setMessage("Enregistrement interrompu. Rechargez la page avant de réessayer."); }
    });
  }

  return (
    <div className="flex flex-col gap-12 lg:flex-row">
      {/* Colonne principale */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-8">
          <label className="flex flex-col gap-2">
            <span className="etiquette">client</span>
            <select
              className="champ w-[260px]"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const cl = clients.find((c) => c.id === e.target.value);
                // La grille du client s'applique aux lignes existantes.
                if (cl) {
                  setLignes((prev) =>
                    prev.map((l) => ({
                      ...l,
                      puHT: cl.grille[l.produitId] ?? l.puHT,
                    })),
                  );
                }
              }}
            >
              <option value="">— choisir —</option>
              {jeu.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="etiquette">date</span>
            <input
              type="date"
              className="champ w-[180px]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {periodes.length > 0 && (
            <label className="flex flex-col gap-2">
              <span className="etiquette">
                <Definition terme="periodeCouts">registre des coûts</Definition>
              </span>
              <select
                className="champ w-[260px]"
                value={periodeId}
                onChange={(e) => setPeriodeId(e.target.value)}
                aria-label="Période de coûts de la commande"
              >
                <option value="">À la date de la commande</option>
                {periodes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.libelle} —{" "}
                    {new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(
                      new Date(x.dateEffet),
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Lignes */}
        <div className="mt-10">
          <table className="tableau">
            <thead>
              <tr>
                <th>produit</th>
                <th className="num">qté</th>
                <th className="num">
                  <Definition terme="prixCession">pu HT</Definition>
                </th>
                <th className="num">
                  <Definition terme="coutComplet">coût / pièce HT</Definition>
                </th>
                <th className="num">
                  <Definition terme="coutRevient">coût total HT</Definition>
                </th>
                <th>
                  <Definition terme="offert">offert</Definition>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select
                      className="champ h-8 w-full max-w-[300px]"
                      value={l.produitId}
                      onChange={(e) => majLigne(i, { produitId: e.target.value })}
                      aria-label={`produit ligne ${i + 1}`}
                    >
                      {jeu.produits.map((p) => (
                        <option key={p.produitId} value={p.produitId}>
                          {p.parfumNom} — {p.formatLibelle}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      className="valeur-editable w-[64px]"
                      inputMode="numeric"
                      value={l.qte}
                      onChange={(e) => majLigne(i, { qte: e.target.value })}
                      aria-label={`quantité ligne ${i + 1}`}
                    />
                  </td>
                  <td className="num">
                    {l.offert ? (
                      <span className="etiquette">offert</span>
                    ) : (
                      <input
                        className="valeur-editable w-[80px]"
                        inputMode="decimal"
                        value={l.puHT}
                        onChange={(e) => majLigne(i, { puHT: e.target.value })}
                        aria-label={`prix unitaire ligne ${i + 1}`}
                      />
                    )}
                  </td>
                  {(() => {
                    const p = parProduit.get(l.produitId);
                    if (!p)
                      return (
                        <>
                          <td className="num">—</td>
                          <td className="num">—</td>
                        </>
                      );
                    const lot = qteParFormatAffichage.get(p.formatId) ?? 0;
                    const cout = coutUnitaire(p, lot, dateCalcul);
                    const q = (Number.isFinite(Number(l.qte)) ? Number(l.qte) : 0);
                    const prix = dSaisie(l.puHT);
                    const sousSeuil =
                      !l.offert &&
                      prix.gt(0) &&
                      prix.minus(cout).div(prix).lt(SEUIL_ALERTE_MARGE);
                    return (
                      <>
                        <td className="num">
                          <span className={`tabulaire ${sousSeuil ? "sous-seuil" : ""}`}>
                            {euro(cout)}
                          </span>
                        </td>
                        <td className="num">
                          <span className={`tabulaire ${sousSeuil ? "sous-seuil" : ""}`}>
                            {q > 0 ? euro(cout.mul(q)) : "—"}
                          </span>
                        </td>
                      </>
                    );
                  })()}
                  <td>
                    <input
                      type="checkbox"
                      checked={l.offert}
                      onChange={(e) => majLigne(i, { offert: e.target.checked })}
                      aria-label={`ligne ${i + 1} offerte`}
                    />
                  </td>
                  <td>
                    <button
                      className="lien-discret"
                      onClick={() =>
                        setLignes((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="lien-discret mt-3" onClick={ajouterLigne}>
            + ajouter une ligne
          </button>
        </div>

        {/* Charges rattachées */}
        <div className="mt-10 border-t border-filet pt-6">
          <h2 className="font-titre text-[24px] font-light text-encre">
            <Definition terme="chargesRattachees">Charges rattachées</Definition>
          </h2>
          {charges.map((c, i) => (
            <div key={i} className="mt-3 flex items-center gap-4">
              <input
                className="champ w-[260px]"
                placeholder="libellé (ex. Sacs)"
                value={c.libelle}
                onChange={(e) =>
                  setCharges((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)),
                  )
                }
                aria-label={`libellé charge ${i + 1}`}
              />
              <input
                className="champ w-[120px] text-right"
                inputMode="decimal"
                placeholder="montant HT"
                value={c.montantHT}
                onChange={(e) =>
                  setCharges((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, montantHT: e.target.value } : x)),
                  )
                }
                aria-label={`montant charge ${i + 1}`}
              />
              <button
                className="lien-discret"
                onClick={() => setCharges((prev) => prev.filter((_, j) => j !== i))}
              >
                retirer
              </button>
            </div>
          ))}
          <button
            className="lien-discret mt-3"
            onClick={() => setCharges((prev) => [...prev, { libelle: "", montantHT: "" }])}
          >
            + ajouter une charge
          </button>
        </div>

        {/* Notes */}
        <div className="mt-10">
          <label className="flex flex-col gap-2">
            <span className="etiquette">notes</span>
            <textarea
              className="champ h-auto w-full max-w-[560px] py-2"
              rows={2}
              style={{ resize: "vertical" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button
            className="bouton-plein"
            onClick={enregistrer}
            disabled={enCours || !clientId || lignes.length === 0}
          >
            {enCours ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
          {message && <span className="text-[13px] text-lecture">{message}</span>}
        </div>
        {commandeId && <div className="mt-8 border-t border-filet pt-6"><ActionsCommande commandeId={commandeId} statut="BROUILLON" avantConfirmer={sauvegarder} /></div>}
      </div>

      {/* Panneau latéral collant (§8.6) */}
      <aside className="w-full shrink-0 lg:w-[240px]">
        <div className="sticky top-12 border-t-2 border-encre pt-4">
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="etiquette">
                <Definition terme="caHT">CA HT</Definition>
              </dt>
              <dd className="text-[18px] tabulaire">{euro(calc.ca)}</dd>
            </div>
            <div>
              <dt className="etiquette">
                <Definition terme="coutRevient">coût de revient</Definition>
              </dt>
              <dd className="text-[15px] tabulaire">{euro(calc.cout)}</dd>
              {calc.coutParFormat.size > 1 &&
                [...calc.coutParFormat.entries()].map(([libelle, montant]) => (
                  <dd key={libelle} className="etiquette tabulaire">
                    dont {libelle} : {euro(montant)}
                  </dd>
                ))}
              {!calc.totalCharges.isZero() && (
                <dd className="etiquette tabulaire">
                  + charges (sacs…) : {euro(calc.totalCharges)}
                </dd>
              )}
            </div>
            <div>
              <dt className="etiquette">
                <Definition terme="margeBrute">marge brute</Definition>
              </dt>
              <dd className="text-[15px] tabulaire">{euro(calc.margeBrute)}</dd>
            </div>
            {!calc.totalCharges.isZero() && (
              <>
                <div>
                  <dt className="etiquette">
                    <Definition terme="chargesRattachees">charges</Definition>
                  </dt>
                  <dd className="text-[15px] tabulaire">{euro(calc.totalCharges)}</dd>
                </div>
                <div>
                  <dt className="etiquette">
                    <Definition terme="margeNette">marge nette</Definition>
                  </dt>
                  <dd className="text-[15px] tabulaire">{euro(calc.margeNette)}</dd>
                </div>
              </>
            )}
            <div className="border-t border-filet pt-3">
              <dt className="etiquette">
                <Definition terme="tauxMarqueBrut">marge en %</Definition>
              </dt>
              <dd
                className={`text-[18px] tabulaire ${sousSeuil ? "sous-seuil" : ""}`}
              >
                {calc.taux === null ? "—" : pourcent(calc.taux)}
              </dd>
              {calc.taux !== null && calc.tauxGamme !== null && (
                <dd className="mt-1 text-[11px] text-lecture">
                  <Definition terme="moyenneGamme">vs gamme</Definition>{" "}
                  {points(calc.taux.minus(calc.tauxGamme))}
                </dd>
              )}
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
