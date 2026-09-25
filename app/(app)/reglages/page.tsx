import { prisma } from "@/lib/db";
import { chargerReglages } from "@/lib/shopify/api";
import { ReglagesShopify } from "@/components/reglages/ReglagesShopify";
import { FileSkuAMapper } from "@/components/reglages/FileSkuAMapper";

export const dynamic = "force-dynamic";

export default async function PageReglages() {
  const [reglages, enAttente, produits] = await Promise.all([
    chargerReglages(),
    prisma.skuAMapper.findMany({
      where: { resolu: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.produit.findMany({
      where: { actif: true },
      include: { parfum: true, format: true },
      orderBy: [{ parfum: { nom: "asc" } }, { format: { libelle: "asc" } }],
    }),
  ]);

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">Réglages</h1>
      <p className="mt-2 text-[15px] text-lecture">
        Connexion à la boutique Shopify (application privée). Le jeton est
        chiffré et jamais réaffiché.
      </p>

      <section className="mt-12">
        <ReglagesShopify
          domaine={reglages?.domaine ?? ""}
          jetonRenseigne={Boolean(reglages?.jetonChiffre)}
          commissionTauxPct={reglages?.commissionTauxPct.toString() ?? "1.4"}
          commissionFixe={reglages?.commissionFixe.toString() ?? "0.25"}
        />
      </section>

      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          SKU à mapper
        </h2>
        <p className="mt-2 text-[13px] text-lecture">
          Commandes Shopify dont le SKU n'existe pas au catalogue. Elles
          n'entrent pas dans les agrégats tant qu'elles ne sont pas rapprochées.
        </p>
        <div className="mt-6">
          <FileSkuAMapper
            enAttente={enAttente.map((s) => ({
              id: s.id,
              idShopify: s.idShopify,
              skuShopify: s.skuShopify,
              libelle: s.libelle,
              qte: s.qte,
              puTTC: s.puTTC.toString(),
            }))}
            produits={produits.map((p) => ({
              produitId: p.id,
              libelle: `${p.parfum.nom} — ${p.format.libelle} (${p.sku})`,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
