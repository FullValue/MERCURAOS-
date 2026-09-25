"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerClient } from "@/app/(app)/clients/actions";

const ROLES = [
  { valeur: "DISTRIBUTEUR", libelle: "distributeur" },
  { valeur: "REVENDEUR", libelle: "revendeur" },
  { valeur: "CORNER", libelle: "corner" },
  { valeur: "D2C", libelle: "vente directe" },
  { valeur: "PROSPECT", libelle: "prospect" },
] as const;

export function NouveauClient() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (!ouvert) {
    return (
      <button className="bouton-plein" onClick={() => setOuvert(true)}>
        Nouveau client
      </button>
    );
  }

  return (
    <div className="border-t border-b border-filet py-6">
      <div className="flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-2">
          <span className="etiquette">nom</span>
          <input className="champ w-[260px]" value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">ville</span>
          <input className="champ w-[180px]" value={ville} onChange={(e) => setVille(e.target.value)} />
        </label>
        <fieldset className="flex items-center gap-4">
          <legend className="etiquette mb-2">rôles</legend>
          {ROLES.map((r) => (
            <label key={r.valeur} className="flex items-center gap-1 text-[13px]">
              <input
                type="checkbox"
                checked={roles.includes(r.valeur)}
                onChange={(e) =>
                  setRoles((prev) =>
                    e.target.checked
                      ? [...prev, r.valeur]
                      : prev.filter((x) => x !== r.valeur),
                  )
                }
              />
              {r.libelle}
            </label>
          ))}
        </fieldset>
        <button
          className="bouton-plein"
          disabled={enCours || !nom.trim() || roles.length === 0}
          onClick={() =>
            demarrer(async () => {
              const r = await creerClient({ nom: nom.trim(), ville: ville.trim() || undefined, roles });
              setMessage(r.message);
              if (r.ok && r.id) router.push(`/clients/${r.id}`);
            })
          }
        >
          {enCours ? "Création…" : "Créer"}
        </button>
        <button className="lien-discret" onClick={() => setOuvert(false)}>
          annuler
        </button>
      </div>
      {message && <p className="mt-3 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
