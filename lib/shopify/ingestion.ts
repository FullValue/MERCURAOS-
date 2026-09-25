import type { Prisma } from "@prisma/client";
import { prisma, type TransactionMercura } from "@/lib/db";
import { Decimal } from "@/lib/calcul";
import { calculerCoutsCommande } from "@/lib/donnees/couts";
import { chargerReglages } from "./api";

/** Sous-ensemble du payload de commande Shopify utilisé à l'ingestion. */
export interface LigneShopify {
  id: number;
  sku: string | null;
  title: string;
  quantity: number;
  price: string; // prix unitaire, TTC si taxes_included
  tax_lines?: { rate: number }[];
  discount_allocations?: { amount: string }[];
}

export interface CommandeShopify {
  id: number;
  order_number: number;
  created_at: string;
  cancelled_at?: string | null;
  taxes_included: boolean;
  current_subtotal_price_set?: { shop_money: { amount: string } };
  current_total_price: string;
  total_tax: string;
  total_shipping_price_set?: { shop_money: { amount: string } };
  line_items: LigneShopify[];
  refunds?: {
    id: number;
    created_at?: string;
    refund_line_items?: { line_item_id: number; quantity: number; subtotal?: string; restock_type?: string }[];
  }[];
}

export type ResultatIngestion =
  | { statut: "ingeree"; reference: string }
  | { statut: "deja_connue" }
  | { statut: "sku_a_mapper"; skus: string[] }
  | { statut: "erreur"; message: string };

/**
 * Prix unitaire HT d'une ligne Shopify. La boutique vend en TTC : on ne
 * calcule JAMAIS une marge sur un montant TTC (§10). Si la taxe est incluse,
 * on divise par (1 + taux de la ligne) ; sinon le prix est déjà HT.
 */
function puHTLigne(ligne: LigneShopify, taxesIncluses: boolean): Decimal {
  const remises = (ligne.discount_allocations ?? []).reduce((total, r) => total.plus(r.amount), new Decimal(0));
  const prix = new Decimal(ligne.price).minus(remises.div(ligne.quantity));
  if (!taxesIncluses) return prix;
  const taux = (ligne.tax_lines ?? []).reduce((total, t) => total + t.rate, 0);
  return taux > 0 ? prix.div(new Decimal(1).plus(taux)) : prix;
}

/**
 * Ingestion d'une commande Shopify (webhook ou synchronisation manuelle).
 * - SKU inconnu → file « SKU à mapper », commande NON créée (jamais ignorée
 *   silencieusement) ;
 * - décomposition HT / TVA / port consignée dans les notes ;
 * - charge automatique « Commission de paiement » selon la règle paramétrée ;
 * - coûts figés à l'ingestion (source SHOPIFY, statut CONFIRMEE).
 */
export async function ingererCommandeShopify(
  commande: CommandeShopify,
): Promise<ResultatIngestion> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260922, 1)`;
    return ingererDansTransaction(commande, tx);
  }, { timeout: 60000, maxWait: 10000 });
}

async function ingererDansTransaction(commande: CommandeShopify, tx: TransactionMercura): Promise<ResultatIngestion> {
  if (!commande.id || !Array.isArray(commande.line_items) || commande.line_items.length === 0 || commande.line_items.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0)) {
    return { statut: "erreur", message: "Commande Shopify invalide." };
  }
  const idShopify = String(commande.id);

  const existante = await tx.commande.findUnique({ where: { idShopify }, include: { lignes: true } });

  // Résolution des SKU (sku catalogue ou skuShopify).
  const produits = await tx.produit.findMany();
  const parSku = new Map<string, (typeof produits)[number]>();
  for (const p of produits) {
    parSku.set(p.sku.toLowerCase(), p);
    if (p.skuShopify) parSku.set(p.skuShopify.toLowerCase(), p);
  }

  const inconnus = commande.line_items.filter(
    (l) => !l.sku || !parSku.has(l.sku.toLowerCase()),
  );
  if (inconnus.length > 0) {
    // La commande entière part en file d'attente.
    for (const l of inconnus) {
      const skuBrut = l.sku ?? `(sans sku) ${l.title}`;
      const dejaEnFile = await tx.skuAMapper.findFirst({
        where: { idShopify, skuShopify: skuBrut, resolu: false },
      });
      if (!dejaEnFile) {
        await tx.skuAMapper.create({
          data: {
            idShopify,
            skuShopify: skuBrut,
            libelle: l.title,
            qte: l.quantity,
            puTTC: l.price,
            payload: commande as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
    return {
      statut: "sku_a_mapper",
      skus: inconnus.map((l) => l.sku ?? l.title),
    };
  }

  const client = await tx.client.findUnique({ where: { nom: "Boutique en ligne" } });
  if (!client) return { statut: "erreur", message: "Client « Boutique en ligne » absent." };

  const date = new Date(commande.created_at);
  const lignes = commande.line_items.map((l) => ({
    produitId: parSku.get(l.sku!.toLowerCase())!.id,
    qte: l.quantity,
    puHT: puHTLigne(l, commande.taxes_included),
  }));

  const couts = await calculerCoutsCommande(
    lignes.map((l) => ({ produitId: l.produitId, qte: l.qte })),
    date, tx,
  );

  // Décomposition HT / TVA / port, consignée pour lecture (§10).
  const totalTTC = new Decimal(commande.current_total_price);
  const tva = new Decimal(commande.total_tax || "0");
  const port = new Decimal(
    commande.total_shipping_price_set?.shop_money.amount ?? "0",
  );
  const sousTotal = new Decimal(
    commande.current_subtotal_price_set?.shop_money.amount ?? "0",
  );

  // Commission de paiement selon la règle paramétrable (défaut 1,4 % + 0,25 €).
  const reglages = await chargerReglages();
  const tauxCommission = new Decimal(reglages?.commissionTauxPct.toString() ?? "1.4").div(100);
  const commission = totalTTC.mul(tauxCommission).plus(
    reglages?.commissionFixe.toString() ?? "0.25",
  );

  const reference = existante?.reference ?? `SH-${commande.order_number}`;
  const maintenant = new Date();
  if (existante) {
    await tx.ligneCommande.deleteMany({ where: { commandeId: existante.id } });
    await tx.charge.deleteMany({ where: { commandeId: existante.id, libelle: "Commission de paiement" } });
  }
  const donnees = {
      reference,
      clientId: client.id,
      date,
      statut: commande.cancelled_at ? "ANNULEE" as const : existante?.statut ?? "CONFIRMEE" as const,
      confirmeLe: existante?.confirmeLe ?? maintenant,
      source: "SHOPIFY" as const,
      idShopify,
      notes: `Décomposition : sous-total ${sousTotal.toFixed(2)} € · TVA ${tva.toFixed(2)} € · port ${port.toFixed(2)} € · total TTC ${totalTTC.toFixed(2)} €`,
      lignes: {
        create: lignes.map((l) => ({
          produitId: l.produitId,
          qte: l.qte,
          puHT: l.puHT.toDecimalPlaces(2).toString(),
          offert: false,
          coutUnitFige: existante?.lignes.find((ancienne) => ancienne.produitId === l.produitId)?.coutUnitFige.toString() ?? couts.get(l.produitId)!,
        })),
      },
      charges: {
        create: [
          {
            libelle: "Commission de paiement",
            montantHT: commission.toDecimalPlaces(2).toString(),
            rattachement: "COMMANDE" as const,
            date,
          },
        ],
      },
  };
  const creee = existante
    ? await tx.commande.update({ where: { id: existante.id }, data: donnees })
    : await tx.commande.create({ data: donnees });

  await traiterRemboursements(commande, creee.id, reference, tx);
  return existante ? { statut: "deja_connue" } : { statut: "ingeree", reference };
}

/**
 * Remboursements (§10) : une commande liée à montant négatif, rien n'est
 * supprimé. Référence : {ref}-R{id du remboursement}.
 */
async function traiterRemboursements(
  commande: CommandeShopify,
  commandeId: string,
  reference: string,
  tx: TransactionMercura,
): Promise<void> {
  if (!commande.refunds?.length) return;

  const originale = await tx.commande.findUnique({
    where: { id: commandeId },
    include: { lignes: true, client: true },
  });
  if (!originale) return;

  const lignesParIdShopify = new Map<number, LigneShopify>(
    commande.line_items.map((l) => [l.id, l]),
  );

  for (const remboursement of commande.refunds) {
    if (!remboursement.refund_line_items?.length) continue;
    const refRemboursement = `${reference}-R${remboursement.id}`;
    const dejaConnue = await tx.commande.findUnique({
      where: { reference: refRemboursement },
    });
    if (dejaConnue) continue;

    // Reconstitue les lignes remboursées en quantités négatives, aux mêmes
    // prix HT et coûts figés que la commande d'origine.
    const lignesNegatives: {
      produitId: string;
      qte: number;
      puHT: string;
      coutUnitFige: string;
    }[] = [];
    for (const rli of remboursement.refund_line_items) {
      const ligneShopify = lignesParIdShopify.get(rli.line_item_id);
      if (!ligneShopify?.sku) continue;
      const produit = await tx.produit.findFirst({
        where: {
          OR: [
            { sku: { equals: ligneShopify.sku, mode: "insensitive" } },
            { skuShopify: { equals: ligneShopify.sku, mode: "insensitive" } },
          ],
        },
      });
      if (!produit) continue;
      // Rapprochement par produit : mêmes prix HT et coût figé que l'origine.
      const ligneCorrespondante = originale.lignes.find(
        (l) => l.produitId === produit.id,
      );
      if (!ligneCorrespondante) continue;
      lignesNegatives.push({
        produitId: produit.id,
        qte: -rli.quantity,
        puHT: rli.subtotal !== undefined && rli.quantity > 0 ? new Decimal(rli.subtotal).div(rli.quantity).toString() : ligneCorrespondante.puHT.toString(),
        coutUnitFige: rli.restock_type === "no_restock" ? "0" : ligneCorrespondante.coutUnitFige.toString(),
      });
    }
    if (lignesNegatives.length === 0) continue;

    await tx.commande.create({
      data: {
        reference: refRemboursement,
        clientId: originale.clientId,
        date: remboursement.created_at ? new Date(remboursement.created_at) : new Date(commande.created_at),
        statut: commande.cancelled_at ? "ANNULEE" : "CONFIRMEE",
        confirmeLe: new Date(),
        source: "SHOPIFY",
        notes: `Remboursement lié à ${reference}`,
        lignes: {
          create: lignesNegatives.map((l) => ({
            produitId: l.produitId,
            qte: l.qte,
            puHT: l.puHT,
            offert: false,
            coutUnitFige: l.coutUnitFige,
          })),
        },
      },
    });
  }
}
