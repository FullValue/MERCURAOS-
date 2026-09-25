import { dateValide } from "@/lib/validation";
import { chargerSynthese } from "@/lib/donnees/synthese";
import { Euro, TauxMarque } from "@/components/ui/Montant";
import { Definition } from "@/components/ui/Definition";
import { ChargesGlobales } from "@/components/synthese/ChargesGlobales";
import { nombre, points, pourcent } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLE_ROLE: Record<string, string> = {
  DISTRIBUTEUR: "distributeur",
  REVENDEUR: "revendeur",
  CORNER: "corner",
  D2C: "vente directe",
  PROSPECT: "prospect",
};

export default async function PageSynthese({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string; fin?: string }>;
}) {
  const params = await searchParams;
  const maintenant = new Date();
  const debut = params.debut && dateValide(params.debut)
    ? new Date(params.debut)
    : new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));
  const finDemandee = params.fin && dateValide(params.fin) ? new Date(`${params.fin}T23:59:59.999Z`) : maintenant;

  const fin = finDemandee < debut ? new Date(`${debut.toISOString().slice(0, 10)}T23:59:59.999Z`) : finDemandee;
  const s = await chargerSynthese(debut, fin);

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">Synthèse</h1>

      {/* Période */}
      <form method="get" className="mt-8 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2">
          <span className="etiquette">du</span>
          <input
            type="date"
            name="debut"
            defaultValue={debut.toISOString().slice(0, 10)}
            className="champ w-[160px]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="etiquette">au</span>
          <input
            type="date"
            name="fin"
            defaultValue={fin.toISOString().slice(0, 10)}
            className="champ w-[160px]"
          />
        </label>
        <button type="submit" className="bouton-plein">
          Appliquer
        </button>
      </form>

      {/* Agrégats de période */}
      <div className="mt-12 flex flex-wrap gap-12 border-t border-filet pt-6">
        <span>
          <span className="etiquette block">
            <Definition terme="caHT">CA HT</Definition>
          </span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.caHT} />
          </span>
        </span>
        <span>
          <span className="etiquette block">
            <Definition terme="coutRevient">coût de revient</Definition>
          </span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.coutRevient} />
          </span>
        </span>
        <span>
          <span className="etiquette block">
            <Definition terme="margeBrute">marge brute</Definition>
          </span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.margeBrute} />
          </span>
        </span>
        <span>
          <span className="etiquette block">
            <Definition terme="chargesRattachees">charges de commandes</Definition>
          </span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.chargesCommandes} />
          </span>
        </span>
        <span>
          <span className="etiquette block">charges fixes de la période</span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.chargesFixes} />
          </span>
        </span>
        <span>
          <span className="etiquette block">
            <Definition terme="margeNette">marge nette globale</Definition>
          </span>
          <span className="text-[18px] tabulaire">
            <Euro valeur={s.margeNette} />
          </span>
        </span>
      </div>

      {/* Écarts à la moyenne de gamme */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">Écarts</h2>
        <p className="mt-2 text-[13px] text-lecture">
          Produits dont la marge en % s'écarte de plus de 5 points de la{" "}
          <Definition terme="moyenneGamme">moyenne de gamme</Definition>.
        </p>
        {s.ecarts.length === 0 ? (
          <p className="mt-4 text-[13px] text-lecture">
            Aucun écart supérieur à 5 points sur la période.
          </p>
        ) : (
          <table className="tableau mt-6 max-w-[720px]">
            <thead>
              <tr>
                <th>référence</th>
                <th>format</th>
                <th className="num">marge en %</th>
                <th className="num">écart</th>
              </tr>
            </thead>
            <tbody>
              {s.ecarts.map((p) => (
                <tr key={p.produitId}>
                  <td>{p.parfumNom}</td>
                  <td>
                    <span className="etiquette">{p.formatLibelle}</span>
                  </td>
                  <td className="num">{p.taux !== null && <TauxMarque valeur={p.taux} />}</td>
                  <td className="num tabulaire">
                    {p.ecartGamme !== null && points(p.ecartGamme)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Marge par produit */}
      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Marge par produit
        </h2>
        {s.parProduit.length === 0 ? (
          <p className="mt-4 text-[13px] text-lecture">Aucune vente sur la période.</p>
        ) : (
          <table className="tableau mt-6">
            <thead>
              <tr>
                <th>référence</th>
                <th>format</th>
                <th className="num">pièces</th>
                <th className="num">CA HT</th>
                <th className="num">
                  <Definition terme="marge">marge</Definition>
                </th>
                <th className="num">
                  <Definition terme="tauxMarque">marge %</Definition>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.parProduit.map((p) => (
                <tr key={p.produitId}>
                  <td>{p.parfumNom}</td>
                  <td>
                    <span className="etiquette">{p.formatLibelle}</span>
                  </td>
                  <td className="num tabulaire">{nombre(p.qte)}</td>
                  <td className="num">
                    <Euro valeur={p.caHT} />
                  </td>
                  <td className="num">
                    <Euro valeur={p.marge} />
                  </td>
                  <td className="num">
                    {p.taux !== null ? <TauxMarque valeur={p.taux} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Marge par client + part par rôle */}
      <div className="mt-12 flex flex-wrap gap-16 border-t border-filet pt-8">
        <section className="min-w-[320px] flex-1">
          <h2 className="font-titre text-[24px] font-light text-encre">
            Marge par client
          </h2>
          {s.parClient.length === 0 ? (
            <p className="mt-4 text-[13px] text-lecture">Aucune vente.</p>
          ) : (
            <table className="tableau mt-6">
              <thead>
                <tr>
                  <th>client</th>
                  <th className="num">CA HT</th>
                  <th className="num">marge</th>
                  <th className="num">marge %</th>
                </tr>
              </thead>
              <tbody>
                {s.parClient.map((c) => (
                  <tr key={c.clientId}>
                    <td>{c.nom}</td>
                    <td className="num">
                      <Euro valeur={c.caHT} />
                    </td>
                    <td className="num">
                      <Euro valeur={c.marge} />
                    </td>
                    <td className="num">
                      {c.taux !== null ? <TauxMarque valeur={c.taux} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="min-w-[280px]">
          <h2 className="font-titre text-[24px] font-light text-encre">
            CA par rôle client
          </h2>
          {s.parRole.length === 0 ? (
            <p className="mt-4 text-[13px] text-lecture">Aucune vente.</p>
          ) : (
            <table className="tableau mt-6">
              <tbody>
                {s.parRole.map((r) => (
                  <tr key={r.role}>
                    <td>
                      <span className="etiquette">{LIBELLE_ROLE[r.role]}</span>
                    </td>
                    <td className="num">
                      <Euro valeur={r.caHT} />
                    </td>
                    <td className="num tabulaire">{pourcent(r.part)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Charges globales */}
      <section className="mt-12 border-t border-filet pt-8 pb-12">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Charges fixes
        </h2>
        <p className="mt-2 text-[13px] text-lecture">
          Loyer, salons, abonnements… Les charges mensuelles et annuelles sont
          imputées au prorata des jours de la période.
        </p>
        <div className="mt-6">
          <ChargesGlobales charges={s.chargesGlobales} />
        </div>
      </section>
    </div>
  );
}
