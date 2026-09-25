import { chargerParametres, chargerPeriodes } from "@/lib/donnees/parametres";
import { chargerChargesGlobales } from "@/lib/donnees/synthese";
import { ParametresEditeur } from "@/components/parametres/ParametresEditeur";
import { CoutsVariables } from "@/components/parametres/CoutsVariables";
import { OngletsPeriodes } from "@/components/parametres/OngletsPeriodes";
import { ChargesGlobales } from "@/components/synthese/ChargesGlobales";
import { dateLongue } from "@/lib/format";
import { prisma } from "@/lib/db";
import { ReferentielProduits } from "@/components/parametres/ReferentielProduits";

export const dynamic = "force-dynamic";

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const params = await searchParams;
  const periodes = await chargerPeriodes();
  // Période sélectionnée : celle de l'URL, sinon la plus récente.
  const periodeActive =
    periodes.find((p) => p.id === params.periode) ?? periodes[0] ?? null;
  const dateEffet = periodeActive ? new Date(periodeActive.dateEffet) : new Date();
  const [etat, chargesFixes, produits] = await Promise.all([
    chargerParametres(dateEffet),
    chargerChargesGlobales(),
    prisma.produit.findMany({ include: { parfum: true, format: true }, orderBy: [{ parfum: { nom: "asc" } }, { format: { libelle: "asc" } }] }),
  ]);

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">
        Registre des coûts
      </h1>
      <p className="mt-2 text-[15px] text-lecture">
        Chaque commande fournisseur est une période de coûts datée ; les valeurs
        antérieures sont conservées. Créez une période avec «&nbsp;+&nbsp;» quand
        les prix changent. L&apos;impact sur le coût complet moyen s&apos;affiche
        en bas de page.
      </p>

      <ReferentielProduits
        formats={etat.formats}
        parfums={etat.parfums}
        produits={produits.map((p) => ({ id: p.id, parfumNom: p.parfum.nom, formatLibelle: p.format.libelle, sku: p.sku, skuShopify: p.skuShopify, actif: p.actif }))}
      />

      <OngletsPeriodes
          periodes={periodes}
          periodeActiveId={periodeActive?.id ?? ""}
          basePath="/parametres"
        />

      {periodeActive && (
        <p className="mt-6 text-[13px] text-lecture">
          Valeurs en vigueur pour «&nbsp;{periodeActive.libelle}&nbsp;» — effet au{" "}
          {dateLongue(new Date(periodeActive.dateEffet))}. Les modifications
          enregistrées ici sont datées de cette période.
        </p>
      )}

      <div className="mt-8">
        <ParametresEditeur
          key={periodeActive?.id ?? "courant"}
          etat={etat}
          periodeId={periodeActive?.id}
          coutsVariables={etat.coutsVariables}
        />
      </div>

      {/* Coûts variables — liés à la commande fournisseur sélectionnée. */}
      <section className="mt-4 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Coûts variables
        </h2>
        <p className="mt-2 text-[13px] text-lecture">
          Douane, transitaire, taxes d&apos;import… Liés à la commande
          fournisseur sélectionnée : répartis sur le nombre de pièces livrées,
          avec les frais de livraison, dans le coût de revient.
        </p>
        <div className="mt-6">
          <CoutsVariables
            key={`cv-${periodeActive?.id ?? "courant"}`}
            couts={etat.coutsVariables}
            tvaRecuperable={etat.tvaRecuperable}
            periodeId={periodeActive?.id}
          />
        </div>
      </section>

      {/* Coûts fixes — indépendants des périodes de coûts (prorata en Synthèse). */}
      <section className="mt-4 border-t border-filet pt-8 pb-12">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Coûts fixes
        </h2>
        <p className="mt-2 text-[13px] text-lecture">
          Loyer, salons, abonnements… Indépendants des commandes fournisseurs :
          les charges mensuelles et annuelles sont imputées au prorata des jours
          dans la Synthèse. La colonne «&nbsp;imputé&nbsp;» ci-dessous porte sur
          l&apos;année en cours.
        </p>
        <div className="mt-6">
          <ChargesGlobales charges={chargesFixes} />
        </div>
      </section>
    </div>
  );
}
