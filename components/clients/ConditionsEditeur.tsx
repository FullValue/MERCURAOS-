"use client";

import { useState, useTransition } from "react";
import { enregistrerConditions } from "@/app/(app)/clients/actions";

/** Encart « conditions » libre (§8.5) : exclusivité, franco, minimum de commande. */
export function ConditionsEditeur({
  clientId,
  notes,
}: {
  clientId: string;
  notes: string | null;
}) {
  const [texte, setTexte] = useState(notes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={4}
        className="champ h-auto w-full max-w-[720px] py-2"
        style={{ resize: "vertical", lineHeight: 1.5 }}
        placeholder="Exclusivité territoriale, franco de port, minimum de commande…"
        aria-label="conditions commerciales"
      />
      <div className="mt-3 flex items-center gap-4">
        <button
          className="bouton-plein"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await enregistrerConditions({ clientId, notes: texte });
              setMessage(r.message);
            })
          }
        >
          {enCours ? "Enregistrement…" : "Enregistrer les conditions"}
        </button>
        {message && <span className="text-[13px] text-lecture">{message}</span>}
      </div>
    </div>
  );
}
