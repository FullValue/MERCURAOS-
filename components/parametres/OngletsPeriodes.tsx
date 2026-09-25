"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerPeriode } from "@/app/(app)/parametres/actions";
import type { PeriodeCoutsInfo } from "@/lib/donnees/parametres";
import { Definition } from "@/components/ui/Definition";

interface Props {
  periodes: PeriodeCoutsInfo[];
  /** Période sélectionnée (défaut : la plus récente). */
  periodeActiveId: string;
  /** Chemin de la page portant les onglets ("/parametres" ou "/catalogue"). */
  basePath: string;
}

function dateCourteISO(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(iso));
}

/**
 * Onglets des périodes de coûts (commandes fournisseurs), la plus récente en
 * tête, avec création par « + ». Partagé entre Paramètres et Catalogue.
 */
export function OngletsPeriodes({ periodes, periodeActiveId, basePath }: Props) {
  const router = useRouter();
  const [creation, setCreation] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function creer() {
    setErreur(null);
    demarrer(async () => {
      const r = await creerPeriode({ libelle, date });
      if (!r.ok || !r.id) {
        setErreur(r.message);
        return;
      }
      setCreation(false);
      setLibelle("");
      router.push(`${basePath}?periode=${r.id}`);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 border-b border-filet">
      <div className="flex flex-wrap items-baseline gap-1" role="tablist" aria-label="Périodes de coûts">
        {periodes.map((p) => {
          const active = p.id === periodeActiveId;
          return (
            <Link
              key={p.id}
              role="tab"
              aria-selected={active}
              href={`${basePath}?periode=${p.id}`}
              className="px-4 py-2 text-[14px] transition-colors"
              style={{
                borderBottom: active ? "2px solid var(--encre)" : "2px solid transparent",
                color: active ? "var(--encre)" : "var(--lecture)",
                fontWeight: active ? 500 : 400,
                marginBottom: -1,
              }}
            >
              {p.libelle}
              <span className="etiquette ml-2">{dateCourteISO(p.dateEffet)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setCreation((v) => !v)}
          aria-expanded={creation}
          aria-label="Créer une période de coûts"
          className="lien-discret px-3 py-2 text-[15px]"
        >
          +
        </button>
        <span className="etiquette ml-auto pb-2">
          <Definition terme="periodeCouts">période de coûts</Definition>
        </span>
      </div>

      {creation && (
        <div className="flex flex-wrap items-end gap-4 border-t border-filet py-4">
          <label className="flex flex-col gap-2">
            <span className="etiquette">libellé (ex. commande fournisseur sept. 2026)</span>
            <input
              className="champ w-[300px]"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Commande fournisseur…"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="etiquette">date d&apos;effet</span>
            <input
              type="date"
              className="champ w-[160px]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button type="button" onClick={creer} disabled={enCours || !libelle.trim()} className="bouton-plein">
            {enCours ? "Création…" : "Créer la période"}
          </button>
          {erreur && <p className="text-[13px] text-alerte">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
