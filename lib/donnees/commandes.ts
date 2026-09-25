import type { SourceCommande, StatutCommande } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Decimal, decompositionCout, valeurAuJour } from "@/lib/calcul";
import type { ProduitContexte } from "@/lib/calcul/types";
import { chargerProduitsEnrichis } from "./produits";

/** Données produit nécessaires à l'éditeur de commande (calcul côté client). */
export interface ProduitPourCommande {
  contexte: ProduitContexte;
  produitId: string;
  parfumNom: string;
  formatId: string;
  formatLibelle: string;
  sku: string;
  matiereEtCond: string;
  coutFixeSerie: string;
  coutVarUnitHT: string;
  qteLotRef: number;
}

export interface ClientPourCommande {
  id: string;
  nom: string;
  /** produitId → prix de cession courant (grille). */
  grille: Record<string, string>;
  historiqueGrille: { produitId: string; prix: string; dateEffet: Date }[];
}

export interface DonneesEditeur {
  produits: ProduitPourCommande[];
  clients: ClientPourCommande[];
}

/** Charge tout ce qu'il faut pour l'éditeur de commande. */
export async function chargerDonneesEditeur(
  date: Date = new Date(),
): Promise<DonneesEditeur> {
  const [enrichis, clients, grilles] = await Promise.all([
    chargerProduitsEnrichis(true),
    prisma.client.findMany({ orderBy: { nom: "asc" } }),
    prisma.grillePrix.findMany(),
  ]);

  const produits: ProduitPourCommande[] = enrichis.map((p) => {
    const fac = valeurAuJour(
      p.contexte.faconnages.map((f) => ({ ...f })),
      date,
    );
    // Décomposition par le moteur : prix du liquide historisé, TVA ramenée en
    // HT, coûts de façonnage (lignes marquées) et livraison répartie inclus.
    const dec = decompositionCout(p.contexte, date);
    // Part de série (fixe amorti au lot de réf. + variable) : retranchée de la
    // base pour être ré-amortie côté éditeur sur les quantités réelles.
    const partSerie = fac
      ? new Decimal(String(fac.coutFixeSerie))
          .div(fac.qteLotRef > 0 ? fac.qteLotRef : 1)
          .plus(String(fac.coutVarUnitHT))
      : new Decimal(0);

    return {
      contexte: p.contexte,
      produitId: p.produitId,
      parfumNom: p.parfumNom,
      formatId: p.formatId,
      formatLibelle: p.formatLibelle,
      sku: p.sku,
      matiereEtCond: dec.complet.minus(partSerie).toString(),
      coutFixeSerie: fac ? String(fac.coutFixeSerie) : "0",
      coutVarUnitHT: fac ? String(fac.coutVarUnitHT) : "0",
      qteLotRef: fac?.qteLotRef ?? 0,
    };
  });

  const clientsAvecGrille: ClientPourCommande[] = clients.map((c) => {
    const grille: Record<string, string> = {};
    const parProduit = new Map<string, { prix: string; dateEffet: Date }[]>();
    for (const g of grilles.filter((g) => g.clientId === c.id)) {
      const liste = parProduit.get(g.produitId) ?? [];
      liste.push({ prix: g.prixCessionHT.toString(), dateEffet: g.dateEffet });
      parProduit.set(g.produitId, liste);
    }
    for (const [produitId, liste] of parProduit) {
      const courant = valeurAuJour(liste, date);
      if (courant) grille[produitId] = courant.prix;
    }
    return { id: c.id, nom: c.nom, grille, historiqueGrille: grilles.filter((g) => g.clientId === c.id).map((g) => ({ produitId: g.produitId, prix: g.prixCessionHT.toString(), dateEffet: g.dateEffet })) };
  });

  return { produits, clients: clientsAvecGrille };
}

export interface CommandeListe {
  id: string;
  reference: string;
  clientNom: string;
  date: string;
  statut: StatutCommande;
  source: SourceCommande;
  caHT: Decimal;
  margeBrute: Decimal;
}

/** Liste des commandes. */
export async function chargerCommandes(): Promise<CommandeListe[]> {
  const commandes = await prisma.commande.findMany({
    include: { client: true, lignes: true },
    orderBy: { date: "desc" },
  });
  return commandes.map((cmd) => {
    let ca = new Decimal(0);
    let cout = new Decimal(0);
    for (const l of cmd.lignes) {
      cout = cout.plus(new Decimal(l.coutUnitFige.toString()).mul(l.qte));
      if (!l.offert) ca = ca.plus(new Decimal(l.puHT.toString()).mul(l.qte));
    }
    return {
      id: cmd.id,
      reference: cmd.reference,
      clientNom: cmd.client.nom,
      date: cmd.date.toISOString(),
      statut: cmd.statut,
      source: cmd.source,
      caHT: ca,
      margeBrute: ca.minus(cout),
    };
  });
}

/** Détail d'une commande. */
export async function chargerCommande(id: string) {
  return prisma.commande.findUnique({
    where: { id },
    include: {
      client: true,
      lignes: { include: { produit: { include: { parfum: true, format: true } } } },
      charges: true,
    },
  });
}
