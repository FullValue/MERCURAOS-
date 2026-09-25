import Link from "next/link";
import { chargerClients } from "@/lib/donnees/clients";
import { Initiales } from "@/components/ui/Initiales";
import { PastilleRole } from "@/components/ui/PastilleRole";
import { TauxMarque } from "@/components/ui/Montant";
import { NouveauClient } from "@/components/clients/NouveauClient";
import { euro, nombre } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PageClients() {
  const clients = await chargerClients();

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-titre text-[32px] font-light text-encre">Clients</h1>
        <NouveauClient />
      </div>

      <div className="mt-12 defile-x">
        <div className="min-w-[760px]">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="grid grid-cols-[36px_1fr_auto_220px_110px_110px] items-center gap-x-6 border-b border-filet py-4 hover:bg-papier"
          >
            <Initiales nom={c.nom} />
            <span>
              <span className="block text-[15px] text-encre">{c.nom}</span>
              {c.ville && <span className="etiquette">{c.ville}</span>}
            </span>
            <span className="flex gap-2">
              {c.roles.map((r) => (
                <PastilleRole key={r} role={r} />
              ))}
            </span>
            <span className="etiquette">
              {c.rappelGrille.length
                ? c.rappelGrille
                    .map((g) =>
                      g.prix === "variable"
                        ? `${g.formatLibelle} : variable`
                        : `${g.formatLibelle} → ${euro(g.prix)}`,
                    )
                    .join(" · ")
                : "grille vide"}
            </span>
            <span className="num text-[15px] tabulaire">
              {c.volumeCumule > 0 ? `${nombre(c.volumeCumule)} pcs` : "—"}
            </span>
            <span className="num text-[15px]">
              {c.tauxMarqueMoyen !== null ? (
                <TauxMarque valeur={c.tauxMarqueMoyen} />
              ) : (
                "—"
              )}
            </span>
          </Link>
        ))}
        </div>
      </div>
    </div>
  );
}
