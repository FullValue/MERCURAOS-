import Link from "next/link";
import { chargerCommandes } from "@/lib/donnees/commandes";
import { Euro } from "@/components/ui/Montant";
import { dateCourte } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLE_STATUT: Record<string, string> = {
  BROUILLON: "brouillon",
  CONFIRMEE: "confirmée",
  LIVREE: "livrée",
  ANNULEE: "annulée",
};

export default async function PageCommandes() {
  const commandes = await chargerCommandes();

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-titre text-[32px] font-light text-encre">Commandes</h1>
        <Link href="/commandes/nouvelle" className="bouton-plein flex items-center">
          Nouvelle commande
        </Link>
      </div>

      {commandes.length === 0 ? (
        <p className="mt-12 text-[13px] text-lecture">Aucune commande.</p>
      ) : (
        <table className="tableau mt-12">
          <thead>
            <tr>
              <th>référence</th>
              <th>client</th>
              <th>date</th>
              <th>statut</th>
              <th>source</th>
              <th className="num">CA HT</th>
              <th className="num">marge brute</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/commandes/${c.id}`} className="hover:underline">
                    {c.reference}
                  </Link>
                </td>
                <td>{c.clientNom}</td>
                <td>{dateCourte(new Date(c.date))}</td>
                <td>
                  <span className="etiquette">{LIBELLE_STATUT[c.statut]}</span>
                </td>
                <td>
                  <span className="etiquette">
                    {c.source === "SHOPIFY" ? "shopify" : "manuel"}
                  </span>
                </td>
                <td className="num">
                  <Euro valeur={c.caHT} />
                </td>
                <td className="num">
                  <Euro valeur={c.margeBrute} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
