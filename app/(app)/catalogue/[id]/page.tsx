import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerFicheProduit } from "@/lib/donnees/produit";
import { chargerPeriodes } from "@/lib/donnees/parametres";
import { ColonneCout } from "@/components/ui/ColonneCout";
import { Definition } from "@/components/ui/Definition";
import { Euro } from "@/components/ui/Montant";
import { SimulateurPrix } from "@/components/produit/SimulateurPrix";

export const dynamic = "force-dynamic";

export default async function PageFicheProduit({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { id } = await params;
  const filtre = await searchParams;
  const periodes = await chargerPeriodes();
  const periode = periodes.find((p) => p.id === filtre.periode) ?? periodes[0];
  const dateEffet = periode ? new Date(periode.dateEffet) : new Date();
  const fiche = await chargerFicheProduit(id, dateEffet);
  if (!fiche) notFound();

  const { decomposition: dec } = fiche;

  return (
    <div>
      <Link href={periode ? `/catalogue?periode=${periode.id}` : "/catalogue"} className="lien-discret">
        ← catalogue
      </Link>
      <h1 className="mt-3 font-titre text-[32px] font-light text-encre">
        {fiche.parfumNom}
      </h1>
      <p className="mt-1 text-[15px] text-lecture">
        {fiche.formatLibelle} · {fiche.sku}
      </p>

      {!fiche.prixLiquideRenseigne && (
        <p className="mt-10 border-l-2 border-marque pl-4 text-[14px] text-lecture">
          Coût à chiffrer : renseignez le prix du liquide, puis les composants et
          le façonnage de ce format dans le{" "}
          <Link href="/parametres" className="lien-discret">Registre des coûts</Link>.
        </p>
      )}

      {fiche.prixLiquideRenseigne && <div className="mt-12 flex flex-wrap items-start gap-16">
        <ColonneCout
          liquide={dec.liquide}
          conditionnement={dec.conditionnement}
          faconnage={dec.faconnage}
        />

        <table className="tableau max-w-[420px] flex-1">
          <tbody>
            <tr>
              <td>
                <Definition terme="liquide">liquide</Definition>
              </td>
              <td className="num">
                <Euro valeur={dec.liquide} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="conditionnement">conditionnement</Definition>
              </td>
              <td className="num">
                <Euro valeur={dec.conditionnement} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="matiereEtCond">matière + conditionnement</Definition>
              </td>
              <td className="num">
                <Euro valeur={dec.matiereEtCond} />
              </td>
            </tr>
            <tr>
              <td>
                <Definition terme="faconnage">façonnage</Definition>
                {fiche.faconnage && (
                  <span className="etiquette ml-2">
                    lot {fiche.faconnage.qteLotRef}
                  </span>
                )}
              </td>
              <td className="num">
                <Euro valeur={dec.faconnage} />
              </td>
            </tr>
            <tr><td>Livraison et coûts variables répartis</td><td className="num"><Euro valeur={dec.livraison} /></td></tr>
            <tr className="total">
              <td>
                <Definition terme="coutComplet">coût complet</Definition>
              </td>
              <td className="num">
                <Euro valeur={dec.complet} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>}

      {fiche.prixLiquideRenseigne && fiche.faconnage && (
        <SimulateurPrix
          contexte={fiche.contexte}
          dateEffet={dateEffet.toISOString()}
          qteLotDefaut={fiche.faconnage.qteLotRef}
          prixDefaut={fiche.prixReference?.toString() ?? dec.complet.mul(2).toDecimalPlaces(2).toString()}
        />
      )}
    </div>
  );
}
