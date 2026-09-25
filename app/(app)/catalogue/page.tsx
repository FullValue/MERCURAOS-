import Link from "next/link";
import { chargerCatalogue, type LigneCatalogue } from "@/lib/donnees/produits";
import {
  chargerParametres,
  chargerPeriodes,
  type EtatParametres,
  type PeriodeCoutsInfo,
} from "@/lib/donnees/parametres";
import { Euro } from "@/components/ui/Montant";
import { FiletDeCharge } from "@/components/ui/FiletDeCharge";
import { Definition } from "@/components/ui/Definition";
import { OngletsPeriodes } from "@/components/parametres/OngletsPeriodes";
import { dateCourte, dateLongue, euro } from "@/lib/format";
import { Decimal } from "@/lib/calcul/decimal";
import { prisma } from "@/lib/db";
import { compositionParDefaut, optionsFormats, type ElementPaquet, type OptionPaquet } from "@/lib/paquet";
import { CompositionPaquet } from "@/components/produit/CompositionPaquet";

export const dynamic = "force-dynamic";

function SectionFormat({
  titre,
  lignes, periodeId,
}: {
  titre: string;
  lignes: LigneCatalogue[];
  periodeId?: string;
}) {
  return (
    <section aria-label={`Références ${titre}`} className="mt-12">
      <h2 className="border-b-2 border-encre pb-2 font-titre text-[24px] font-light text-encre">
        {titre}
      </h2>

      <div className="defile-x">
        <div className="min-w-[660px]">
          <div className="grid grid-cols-[1fr_150px_130px_150px] gap-x-6 border-b border-filet pb-2 pt-4">
            <span className="etiquette">référence</span>
            <span className="etiquette text-right">
              <Definition terme="matiereEtCond">matière + cond.</Definition>
            </span>
            <span className="etiquette text-right">
              <Definition terme="faconnage">façonnage</Definition>
            </span>
            <span className="etiquette text-right">
              <Definition terme="coutComplet">coût complet</Definition>
            </span>
          </div>

          {lignes.map((l) => (
        <div key={l.produitId} className="border-b border-filet py-3">
          <div className="grid grid-cols-[1fr_150px_130px_150px] items-baseline gap-x-6">
            <Link
              href={`/catalogue/${l.produitId}${periodeId ? `?periode=${periodeId}` : ""}`}
              className="text-[15px] text-encre hover:underline"
            >
              {l.parfumNom}
            </Link>
            <span className="num text-[15px]">
              {l.prixLiquideRenseigne ? <Euro valeur={l.decomposition.matiereEtCond} /> : <span className="etiquette">à chiffrer</span>}
            </span>
            <span className="num text-[15px]">
              {l.prixLiquideRenseigne ? <Euro valeur={l.decomposition.faconnage} /> : "—"}
            </span>
            <span className="num text-[15px]">
              {l.prixLiquideRenseigne ? <Euro valeur={l.decomposition.complet} /> : "—"}
              {l.prixLiquideRenseigne && l.decomposition.livraison.gt(0) && (
                <span className="etiquette block">
                  dont <Definition terme="fraisLivraison" discret>livraison</Definition>{" "}
                  {euro(l.decomposition.livraison)}
                </span>
              )}
            </span>
          </div>
              {l.prixLiquideRenseigne && l.prixReference && (
                <div className="mt-2">
                  <FiletDeCharge
                    coutComplet={l.decomposition.complet}
                    prixCessionHT={l.prixReference}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RegistreCouts({
  periodes,
  etats,
}: {
  periodes: PeriodeCoutsInfo[];
  etats: EtatParametres[];
}) {
  return (
    <section className="mt-16 border-t border-filet pt-8 pb-12">
      <h2 className="font-titre text-[24px] font-light text-encre">
        Historique des commandes fournisseurs
      </h2>
      <p className="mt-2 text-[13px] text-lecture">
        La photographie des coûts de chaque{" "}
        <Definition terme="periodeCouts">période</Definition> (commande
        fournisseur). Le détail complet s&apos;édite dans le Registre des coûts.
      </p>

      <div className="mt-6">
        {periodes.map((p, i) => {
          const etat = etats[i];
          if (!etat) return null;
          return (
            <details key={p.id} className="border-b border-filet py-3">
              <summary className="flex cursor-pointer list-none items-baseline gap-4">
                <span className="text-[15px] text-encre">{p.libelle}</span>
                <span className="etiquette">
                  effet au {dateCourte(new Date(p.dateEffet))}
                </span>
                <span className="lien-discret ml-auto">déplier</span>
              </summary>

              <div className="grid grid-cols-1 gap-x-12 gap-y-6 py-4 md:grid-cols-2">
                <div>
                  <span className="etiquette">
                    <Definition terme="prixLiquide">prix du liquide</Definition> (€ HT/litre)
                  </span>
                  <table className="tableau mt-2">
                    <tbody>
                      {etat.prixLiquides.map((x) => (
                        <tr key={x.parfumId}>
                          <td>{x.parfumNom}</td>
                          <td className="num tabulaire">
                            {euro(x.prixLitreHT)}
                            {x.tvaIncluse && <span className="etiquette ml-1">TTC</span>}
                          </td>
                          <td className="num tabulaire">
                            {x.litresCommandes ? `${x.litresCommandes} L` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <span className="etiquette">
                    <Definition terme="conditionnement">composants</Definition> (€ HT/unité)
                  </span>
                  <table className="tableau mt-2">
                    <tbody>
                      {etat.composants.map((c) => (
                        <tr key={`${c.formatId}-${c.libelle}`}>
                          <td>
                            {c.libelle}{" "}
                            <span className="etiquette">{c.formatLibelle}</span>
                            {c.optionnel && <span className="etiquette ml-1">optionnel</span>}
                          </td>
                          <td className="num tabulaire">
                            {euro(c.coutUnitHT)}
                            {c.tvaIncluse && <span className="etiquette ml-1">TTC</span>}
                          </td>
                          <td className="num tabulaire">
                            {c.qteCommandee ? `× ${c.qteCommandee}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <span className="etiquette mt-4 block">divers</span>
                  <table className="tableau mt-2">
                    <tbody>
                      <tr>
                        <td>
                          <Definition terme="tauxPerte">taux de perte</Definition>
                        </td>
                        <td className="num tabulaire">{etat.tauxPerte}</td>
                      </tr>
                      {etat.coutsVariables.map((cv) => (
                        <tr key={cv.id}>
                          <td>
                            {cv.libelle} <span className="etiquette">coût variable</span>
                          </td>
                          <td className="num tabulaire">
                            {euro(cv.montant)}
                            {cv.tvaIncluse && <span className="etiquette ml-1">TTC</span>}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <Definition terme="fraisLivraison">frais de livraison</Definition>
                          {etat.livraisonNbPieces && (
                            <span className="etiquette ml-1">
                              / {etat.livraisonNbPieces} pièces
                            </span>
                          )}
                        </td>
                        <td className="num tabulaire">
                          {etat.fraisLivraison ? euro(etat.fraisLivraison) : "—"}
                          {etat.fraisLivraisonTtc && <span className="etiquette ml-1">TTC</span>}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default async function PageCatalogue({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const params = await searchParams;
  const periodes = await chargerPeriodes();
  const periodeActive =
    periodes.find((p) => p.id === params.periode) ?? periodes[0] ?? null;
  const dateEffet = periodeActive ? new Date(periodeActive.dateEffet) : new Date();

  const [lignes, configuration, ...etats] = await Promise.all([
    chargerCatalogue(dateEffet),
    prisma.compositionPaquet.findUnique({ where: { id: "principal" } }),
    ...periodes.map((p) => chargerParametres(new Date(p.dateEffet))),
  ]);
  const etatActif = periodeActive
    ? etats[periodes.findIndex((p) => p.id === periodeActive.id)] ?? null
    : null;

  // Tri par coût complet décroissant : la référence la plus tendue en tête (§8.2).
  lignes.sort((a, b) => b.decomposition.complet.comparedTo(a.decomposition.complet));

  // Tous les formats actifs, du plus grand au plus petit.
  const libellesFormats = [...new Set(lignes.map((l) => l.formatLibelle))];
  libellesFormats.sort((a, b) => {
    const volumeA = etatActif?.formats.find((f) => f.libelle === a)?.volumeL ?? "0";
    const volumeB = etatActif?.formats.find((f) => f.libelle === b)?.volumeL ?? "0";
    return new Decimal(volumeB).comparedTo(new Decimal(volumeA));
  });
  const sections = libellesFormats.map((libelle) => ({
    libelle,
    lignes: lignes.filter((l) => l.formatLibelle === libelle),
  })).filter((s) => s.lignes.length > 0);

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">Catalogue</h1>
      <p className="mt-2 text-[15px] text-lecture">
        {lignes.length} références. Coût de revient calculé sur la quantité de
        lot de référence. Le{" "}
        <Definition terme="filetDeCharge">trait sous chaque référence</Definition>{" "}
        montre la part du coût (en noir) dans le prix de vente de référence —
        le reste est la marge.
      </p>

      {lignes.length === 0 && (
        <div className="mt-10 border-t border-filet pt-8">
          <p className="text-[15px] text-lecture">Aucune référence Mercura pour le moment. Ajoutez d&apos;abord vos formats, parfums et SKU, puis saisissez leurs coûts.</p>
          <Link href="/parametres" className="bouton-plein mt-5 inline-flex items-center">Ouvrir le registre des coûts</Link>
        </div>
      )}

      {lignes.some((l) => !l.prixLiquideRenseigne) && (
        <p className="mt-8 border-l-2 border-marque pl-4 text-[14px] text-lecture">
          Ces références sont prêtes à être chiffrées. Renseignez le prix du liquide,
          puis les composants et le façonnage propres à chaque format dans le{" "}
          <Link href="/parametres" className="lien-discret">Registre des coûts</Link>.
        </p>
      )}

      {periodeActive && (
        <OngletsPeriodes
          periodes={periodes}
          periodeActiveId={periodeActive.id}
          basePath="/catalogue"
        />
      )}

      {periodeActive && (
        <p className="mt-6 text-[13px] text-lecture">
          Coûts de la période «&nbsp;{periodeActive.libelle}&nbsp;» — effet au{" "}
          {dateLongue(new Date(periodeActive.dateEffet))}.
        </p>
      )}

      {sections.map((s) => (
        <SectionFormat key={s.libelle} titre={s.libelle} lignes={s.lignes} periodeId={periodeActive?.id} />
      ))}

      {etatActif && (
        <section className="mt-16 border-t border-filet pt-8">
          <h2 className="font-titre text-[24px] font-light text-encre">
            <Definition terme="coutPaquet">Coût du paquet</Definition>
          </h2>
          {(() => {
            const optionsFormat = optionsFormats(lignes);
            optionsFormat.sort((a, b) => libellesFormats.indexOf(a.libelle) - libellesFormats.indexOf(b.libelle));
            const optionnels = etatActif.composants.filter((c) => c.optionnel && !c.faconnage);
            const occurrences = new Map<string, number>();
            optionnels.forEach((c) => occurrences.set(c.libelle, (occurrences.get(c.libelle) ?? 0) + 1));
            const optionsComposant: OptionPaquet[] = optionnels.map((c) => ({
              type: "composant", formatId: c.formatId, libelle: c.libelle,
              nom: occurrences.get(c.libelle)! > 1 ? `${c.libelle} (${c.formatLibelle})` : c.libelle,
            }));
            const coutsComposants = optionnels.map((c) => ({
              formatId: c.formatId, libelle: c.libelle,
              cout: (c.tvaIncluse && etatActif.tvaRecuperable
                ? new Decimal(c.coutUnitHT).div("1.2")
                : new Decimal(c.coutUnitHT)).toString(),
            }));
            const options = [...optionsFormat, ...optionsComposant];
            const initiale = configuration
              ? configuration.elements as unknown as ElementPaquet[]
              : compositionParDefaut(options);
            return (
              <CompositionPaquet key={configuration?.updatedAt.toISOString() ?? "defaut"}
                initiale={initiale} options={options}
                produits={lignes.map((l) => ({ parfumNom: l.parfumNom, formatId: l.formatId, cout: l.decomposition.complet.toString() }))}
                composants={coutsComposants} />
            );
          })()}
        </section>
      )}

      <RegistreCouts periodes={periodes} etats={etats} />
    </div>
  );
}
