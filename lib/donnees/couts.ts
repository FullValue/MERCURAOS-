import { prisma, type TransactionMercura } from "@/lib/db";
import { ErreurMetier } from "@/lib/actions";
import { decompositionCout } from "@/lib/calcul";
import { chargerProduitsEnrichis } from "./produits";

/**
 * Coût unitaire de chaque ligne d'une commande, avec l'effet volume :
 * qteLot = quantité totale du format dans la commande (§5.2).
 * Retourne produitId → coût complet (chaîne décimale non arrondie).
 */
export async function calculerCoutsCommande(
  lignes: { produitId: string; qte: number }[],
  date: Date,
  db: TransactionMercura = prisma,
): Promise<Map<string, string>> {
  const produits = await chargerProduitsEnrichis(true, db);
  const parProduit = new Map(produits.map((p) => [p.produitId, p]));

  const qteParFormat = new Map<string, number>();
  for (const l of lignes) {
    const p = parProduit.get(l.produitId);
    if (!p) throw new ErreurMetier(`Produit inconnu : ${l.produitId}`);
    qteParFormat.set(p.formatId, (qteParFormat.get(p.formatId) ?? 0) + l.qte);
  }

  const couts = new Map<string, string>();
  for (const l of lignes) {
    const p = parProduit.get(l.produitId)!;
    const qteLot = qteParFormat.get(p.formatId)!;
    couts.set(l.produitId, decompositionCout(p.contexte, date, { qteLot }).complet.toString());
  }
  return couts;
}
