import Link from "next/link";
import { notFound } from "next/navigation";
import { agregatsCommande, Decimal } from "@/lib/calcul";
import { chargerCommande, chargerDonneesEditeur } from "@/lib/donnees/commandes";
import { chargerPeriodes } from "@/lib/donnees/parametres";
import { Euro, TauxMarque } from "@/components/ui/Montant";
import { Definition } from "@/components/ui/Definition";
import { ActionsCommande } from "@/components/commandes/ActionsCommande";
import { CommandeEditeur } from "@/components/commandes/CommandeEditeur";
import { dateCourte, dateLongue } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLE_STATUT: Record<string, string> = {
  BROUILLON: "brouillon",
  CONFIRMEE: "confirmée",
  LIVREE: "livrée",
  ANNULEE: "annulée",
};

export default async function PageCommande({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const commande = await chargerCommande(id);
  if (!commande) notFound();

  const brouillon = commande.statut === "BROUILLON";

  // En brouillon : édition complète (les coûts se recalculent à chaque enregistrement).
  if (brouillon) {
    const periodes = await chargerPeriodes();
    const donnees = await chargerDonneesEditeur(commande.date);
    const initialPeriodeId = commande.dateCouts
      ? periodes.find(
          (p) => new Date(p.dateEffet).getTime() === commande.dateCouts!.getTime(),
        )?.id
      : undefined;
    return (
      <div>
        <Link href="/commandes" className="lien-discret">
          ← commandes
        </Link>
        <div className="mt-3 flex items-baseline gap-4">
          <h1 className="font-titre text-[32px] font-light text-encre">
            {commande.reference}
          </h1>
          <span className="etiquette">brouillon</span>
        </div>
        <div className="mt-8">
          <CommandeEditeur
            donnees={donnees}
            periodes={periodes}
            initialPeriodeId={initialPeriodeId}
            commandeId={commande.id}
            initial={{
              clientId: commande.clientId,
              date: commande.date.toISOString().slice(0, 10),
              notes: commande.notes ?? "",
              lignes: commande.lignes.map((l) => ({
                produitId: l.produitId,
                qte: String(l.qte),
                puHT: l.puHT.toString(),
                offert: l.offert,
              })),
              charges: commande.charges.map((c) => ({
                libelle: c.libelle,
                montantHT: c.montantHT.toString(),
              })),
            }}
          />
        </div>

      </div>
    );
  }

  // Confirmée / livrée / annulée : lecture seule, coûts figés.
  const ag = agregatsCommande(
    commande.lignes.map((l) => ({
      qte: l.qte,
      puHT: l.puHT.toString(),
      offert: l.offert,
      coutUnitFige: l.coutUnitFige.toString(),
    })),
    commande.charges.map((c) => ({ montantHT: c.montantHT.toString() })),
  );

  return (
    <div>
      <Link href="/commandes" className="lien-discret">
        ← commandes
      </Link>
      <div className="mt-3 flex items-baseline gap-4">
        <h1 className="font-titre text-[32px] font-light text-encre">
          {commande.reference}
        </h1>
        <span className="etiquette">{LIBELLE_STATUT[commande.statut]}</span>
      </div>
      <p className="mt-1 text-[15px] text-lecture">
        {commande.client.nom} · {dateCourte(commande.date)}
        {commande.source === "SHOPIFY" && " · shopify"}
      </p>

      {commande.confirmeLe && commande.statut !== "ANNULEE" && (
        <p className="mt-6 border-t border-b border-filet py-3 text-[13px] text-lecture">
          <Definition terme="coutFige">coûts figés</Definition> au{" "}
          {dateLongue(commande.confirmeLe)}
        </p>
      )}

      <table className="tableau mt-10">
        <thead>
          <tr>
            <th>produit</th>
            <th className="num">qté</th>
            <th className="num">pu HT</th>
            <th className="num">
              <Definition terme="coutFige">coût unitaire figé</Definition>
            </th>
            <th className="num">CA ligne</th>
          </tr>
        </thead>
        <tbody>
          {commande.lignes.map((l) => (
            <tr key={l.id}>
              <td>
                {l.produit.parfum.nom} — {l.produit.format.libelle}
                {l.offert && <span className="etiquette ml-2">offert</span>}
              </td>
              <td className="num tabulaire">{l.qte}</td>
              <td className="num">
                {l.offert ? <span className="etiquette">—</span> : <Euro valeur={l.puHT.toString()} />}
              </td>
              <td className="num">
                <Euro valeur={l.coutUnitFige.toString()} />
              </td>
              <td className="num">
                {l.offert ? (
                  <span className="etiquette">0,00 €</span>
                ) : (
                  <Euro valeur={new Decimal(l.puHT.toString()).mul(l.qte)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {commande.charges.length > 0 && (
        <div className="mt-8">
          <h2 className="etiquette">
            <Definition terme="chargesRattachees">charges rattachées</Definition>
          </h2>
          <table className="tableau mt-2 max-w-[420px]">
            <tbody>
              {commande.charges.map((c) => (
                <tr key={c.id}>
                  <td>{c.libelle}</td>
                  <td className="num">
                    <Euro valeur={c.montantHT.toString()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10 max-w-[420px]">
        <table className="tableau">
          <tbody>
            <tr>
              <td>
                <Definition terme="caHT">CA HT</Definition>
              </td>
              <td className="num">
                <Euro valeur={ag.caHT} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="coutRevient">coût de revient</Definition>
              </td>
              <td className="num">
                <Euro valeur={ag.coutRevient} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="chargesRattachees">charges rattachées</Definition>
              </td>
              <td className="num">
                <Euro valeur={ag.chargesRattachees} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="margeBrute">marge brute</Definition>
              </td>
              <td className="num">
                <Euro valeur={ag.margeBrute} />
              </td>
            </tr>
            <tr className="total">
              <td>
                <Definition terme="margeNette">marge nette</Definition>
              </td>
              <td className="num">
                <Euro valeur={ag.margeNette} />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 flex gap-8">
          <span className="text-[15px]">
            <span className="etiquette block">
              <Definition terme="tauxMarqueBrut">marge en % (brute)</Definition>
            </span>
            <TauxMarque valeur={ag.tauxMarqueBrut} />
          </span>
          <span className="text-[15px]">
            <span className="etiquette block">
              <Definition terme="tauxMarqueNet">marge en % (nette)</Definition>
            </span>
            <TauxMarque valeur={ag.tauxMarqueNet} terme="tauxMarqueNet" />
          </span>
        </div>
      </div>

      <div className="mt-12 border-t border-filet pt-6">
        <ActionsCommande commandeId={commande.id} statut={commande.statut} source={commande.source} />
      </div>
    </div>
  );
}
