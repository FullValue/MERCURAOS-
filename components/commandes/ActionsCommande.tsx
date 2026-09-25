"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changerStatut, confirmerCommande, rouvrirCommande, supprimerCommande } from "@/app/(app)/commandes/actions";

type Resultat = { ok: boolean; message: string };
export function ActionsCommande({ commandeId, statut, source = "MANUEL", avantConfirmer }: {
  commandeId: string; statut: string; source?: string; avantConfirmer?: () => Promise<Resultat>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  function lancer(fn: () => Promise<Resultat>, suppression = false) {
    setMessage(null);
    demarrer(async () => {
      try {
        const r = await fn();
        setMessage(r.message);
        if (r.ok) { if (suppression) router.replace("/commandes"); router.refresh(); }
      } catch { setMessage("Action interrompue. Rechargez la page avant de réessayer."); }
    });
  }
  return <div className="flex flex-wrap items-center gap-4">
    {statut === "BROUILLON" && <button className="bouton-plein" disabled={enCours} onClick={() => lancer(async () => {
      if (avantConfirmer) { const r = await avantConfirmer(); if (!r.ok) return r; }
      return confirmerCommande(commandeId);
    })}>{enCours ? "…" : "Enregistrer et confirmer"}</button>}
    {statut === "CONFIRMEE" && <button className="bouton-plein" disabled={enCours} onClick={() => lancer(() => changerStatut(commandeId, "LIVREE"))}>Marquer livrée</button>}
    {statut !== "BROUILLON" && source === "MANUEL" && <button className="bouton-plein" disabled={enCours} onClick={() => {
      if (window.confirm("Rouvrir cette commande pour la modifier ? Elle sera retirée de la synthèse jusqu’à sa prochaine confirmation. Les coûts seront recalculés.")) lancer(() => rouvrirCommande(commandeId));
    }}>Modifier la commande</button>}
    {statut !== "ANNULEE" && <button className="lien-discret" disabled={enCours} onClick={() => {
      if (window.confirm("Annuler cette commande et la retirer de la synthèse ?")) lancer(() => changerStatut(commandeId, "ANNULEE"));
    }}>Annuler la commande</button>}
    {source === "MANUEL" && <button className="lien-discret text-alerte" disabled={enCours} onClick={() => {
      if (window.confirm("Supprimer définitivement cette commande, ses lignes et ses charges ? Cette opération est irréversible.")) lancer(() => supprimerCommande(commandeId), true);
    }}>Supprimer la commande</button>}
    {message && <span role="status" className="text-[13px] text-lecture">{message}</span>}
  </div>;
}
