import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerFicheClient } from "@/lib/donnees/client";
import { PastilleRole } from "@/components/ui/PastilleRole";
import { Euro, TauxMarque } from "@/components/ui/Montant";
import { Definition } from "@/components/ui/Definition";
import { GrilleEditeur } from "@/components/clients/GrilleEditeur";
import { ConditionsEditeur } from "@/components/clients/ConditionsEditeur";
import { dateCourte } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLE_STATUT: Record<string, string> = {
  BROUILLON: "brouillon",
  CONFIRMEE: "confirmée",
  LIVREE: "livrée",
  ANNULEE: "annulée",
};

export default async function PageFicheClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fiche = await chargerFicheClient(id);
  if (!fiche) notFound();

  return (
    <div>
      <Link href="/clients" className="lien-discret">
        ← clients
      </Link>
      <div className="mt-3 flex items-baseline gap-4">
        <h1 className="font-titre text-[32px] font-light text-encre">{fiche.nom}</h1>
        <span className="flex gap-2">
          {fiche.roles.map((r) => (
            <PastilleRole key={r} role={r} />
          ))}
        </span>
      </div>
      <p className="mt-1 text-[15px] text-lecture">
        {[fiche.contact, fiche.email, fiche.ville].filter(Boolean).join(" · ") || " "}
      </p>

      {/* Marge cumulée réalisée */}
      <div className="mt-8 flex gap-12 border-t border-filet pt-6">
        <span className="text-[15px]">
          <span className="etiquette block">
            <Definition terme="caHT">chiffre d'affaires cumulé</Definition>
          </span>
          <Euro valeur={fiche.caCumule} />
        </span>
        <span className="text-[15px]">
          <span className="etiquette block">
            <Definition terme="margeBrute">marge cumulée</Definition>
          </span>
          <Euro valeur={fiche.margeCumulee} />
        </span>
        {!fiche.caCumule.isZero() && (
          <span className="text-[15px]">
            <span className="etiquette block">
              <Definition terme="tauxMarqueBrut">marge moyenne en %</Definition>
            </span>
            <TauxMarque valeur={fiche.margeCumulee.div(fiche.caCumule)} />
          </span>
        )}
      </div>

      {/* Grille tarifaire */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Grille tarifaire
        </h2>
        <p className="mt-2 text-[13px] text-lecture">
          Chaque modification crée un nouveau prix daté ; les prix antérieurs
          restent consultables dans l'historique.
        </p>
        <div className="mt-6">
          <GrilleEditeur clientId={fiche.id} grille={fiche.grille} />
        </div>
      </section>

      {/* Conditions */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">Conditions</h2>
        <div className="mt-4">
          <ConditionsEditeur clientId={fiche.id} notes={fiche.notes} />
        </div>
      </section>

      {/* Historique des commandes */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">Commandes</h2>
        {fiche.commandes.length === 0 ? (
          <p className="mt-4 text-[13px] text-lecture">Aucune commande.</p>
        ) : (
          <table className="tableau mt-6 max-w-[720px]">
            <thead>
              <tr>
                <th>référence</th>
                <th>date</th>
                <th>statut</th>
                <th className="num">CA HT</th>
                <th className="num">marge brute</th>
              </tr>
            </thead>
            <tbody>
              {fiche.commandes.map((cmd) => (
                <tr key={cmd.id}>
                  <td>
                    <Link href={`/commandes/${cmd.id}`} className="hover:underline">
                      {cmd.reference}
                    </Link>
                  </td>
                  <td>{dateCourte(new Date(cmd.date))}</td>
                  <td>
                    <span className="etiquette">{LIBELLE_STATUT[cmd.statut]}</span>
                  </td>
                  <td className="num">
                    <Euro valeur={cmd.caHT} />
                  </td>
                  <td className="num">
                    <Euro valeur={cmd.margeBrute} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
