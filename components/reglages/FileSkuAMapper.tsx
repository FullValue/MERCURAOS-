"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resoudreSku } from "@/app/(app)/reglages/actions";
import { euro } from "@/lib/format";

export interface SkuEnAttente {
  id: string;
  idShopify: string;
  skuShopify: string;
  libelle: string | null;
  qte: number;
  puTTC: string;
}

export interface ProduitChoix {
  produitId: string;
  libelle: string;
}

export function FileSkuAMapper({
  enAttente,
  produits,
}: {
  enAttente: SkuEnAttente[];
  produits: ProduitChoix[];
}) {
  const router = useRouter();
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (enAttente.length === 0) {
    return (
      <p className="text-[13px] text-lecture">
        Aucun SKU en attente de rapprochement.
      </p>
    );
  }

  return (
    <div>
      <table className="tableau max-w-[860px]">
        <thead>
          <tr>
            <th>commande shopify</th>
            <th>sku inconnu</th>
            <th>article</th>
            <th className="num">qté</th>
            <th className="num">pu TTC</th>
            <th>produit du catalogue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {enAttente.map((s) => (
            <tr key={s.id}>
              <td className="tabulaire">{s.idShopify}</td>
              <td>{s.skuShopify}</td>
              <td>{s.libelle}</td>
              <td className="num tabulaire">{s.qte}</td>
              <td className="num tabulaire">{euro(s.puTTC)}</td>
              <td>
                <select
                  className="champ h-8 w-[240px]"
                  value={choix[s.id] ?? ""}
                  onChange={(e) =>
                    setChoix((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                >
                  <option value="">— choisir —</option>
                  {produits.map((p) => (
                    <option key={p.produitId} value={p.produitId}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  className="lien-discret"
                  disabled={enCours || !choix[s.id]}
                  onClick={() =>
                    demarrer(async () => {
                      const r = await resoudreSku({
                        skuAMapperId: s.id,
                        produitId: choix[s.id]!,
                      });
                      setMessage(r.message);
                      router.refresh();
                    })
                  }
                >
                  rapprocher
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="mt-3 text-[13px] text-lecture">{message}</p>}
    </div>
  );
}
