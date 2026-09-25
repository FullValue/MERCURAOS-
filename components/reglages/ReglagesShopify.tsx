"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enregistrerReglages,
  synchroniserShopify,
  testerConnexionShopify,
} from "@/app/(app)/reglages/actions";

interface Props {
  domaine: string;
  jetonRenseigne: boolean;
  commissionTauxPct: string;
  commissionFixe: string;
}

export function ReglagesShopify(props: Props) {
  const router = useRouter();
  const [domaine, setDomaine] = useState(props.domaine);
  const [jeton, setJeton] = useState("");
  const [taux, setTaux] = useState(props.commissionTauxPct);
  const [fixe, setFixe] = useState(props.commissionFixe);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMessage(null);
    demarrer(async () => {
      const r = await fn();
      setMessage(r.message);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-2">
          <span className="etiquette">domaine de la boutique</span>
          <input
            className="champ w-[280px]"
            placeholder="mercura.myshopify.com"
            value={domaine}
            onChange={(e) => setDomaine(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">
            jeton Admin API{" "}
            {props.jetonRenseigne && "(renseigné — laisser vide pour conserver)"}
          </span>
          <input
            className="champ w-[280px]"
            type="password"
            autoComplete="off"
            placeholder={props.jetonRenseigne ? "••••••••" : "shpat_…"}
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-2">
          <span className="etiquette">commission (%)</span>
          <input
            className="champ w-[100px] text-right"
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">commission fixe (€)</span>
          <input
            className="champ w-[100px] text-right"
            inputMode="decimal"
            value={fixe}
            onChange={(e) => setFixe(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          className="bouton-plein"
          disabled={enCours}
          onClick={() =>
            lancer(() =>
              enregistrerReglages({
                domaine,
                jeton: jeton || undefined,
                commissionTauxPct: taux,
                commissionFixe: fixe,
              }),
            )
          }
        >
          Enregistrer
        </button>
        <button
          className="lien-discret"
          disabled={enCours}
          onClick={() => lancer(testerConnexionShopify)}
        >
          tester la connexion
        </button>
        <button
          className="lien-discret"
          disabled={enCours}
          onClick={() => lancer(synchroniserShopify)}
        >
          synchroniser les 60 derniers jours
        </button>
      </div>

      <p className="mt-4 text-[11px] text-lecture">
        Le scope read_orders ne donne accès qu'aux 60 derniers jours. Pour un
        historique complet, demandez le scope protégé read_all_orders à Shopify.
      </p>

      {message && <p className="mt-4 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
