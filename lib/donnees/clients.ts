import type { RoleClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Decimal, valeurAuJourParGroupe } from "@/lib/calcul";

export interface LigneClient {
  id: string;
  nom: string;
  ville: string | null;
  roles: RoleClient[];
  /** Rappel de grille : libellé format → prix courant (si uniforme sur le format). */
  rappelGrille: { formatLibelle: string; prix: string }[];
  /** Volume cumulé (pièces) sur les commandes confirmées/livrées. */
  volumeCumule: number;
  /** Taux de marque brut moyen réalisé (marge brute cumulée / CA cumulé), null si aucun CA. */
  tauxMarqueMoyen: Decimal | null;
}

/** Liste des clients (§8.4) avec rôles, rappel de grille, volume et taux moyen. */
export async function chargerClients(date: Date = new Date()): Promise<LigneClient[]> {
  const clients = await prisma.client.findMany({
    where: { actif: true },
    include: {
      roles: true,
      grille: { include: { produit: { include: { format: true } } } },
      commandes: {
        where: { statut: { in: ["CONFIRMEE", "LIVREE"] } },
        include: { lignes: true },
      },
    },
    orderBy: { nom: "asc" },
  });

  return clients.map((c) => {
    // Grille courante par produit (valeurAuJour par produit), puis regroupée par format.
    const courantes = valeurAuJourParGroupe(
      c.grille.map((g) => ({
        produitId: g.produitId,
        formatLibelle: g.produit.format.libelle,
        prix: g.prixCessionHT.toString(),
        dateEffet: g.dateEffet,
      })),
      date,
      (g) => g.produitId,
    );
    const parFormat = new Map<string, Set<string>>();
    for (const g of courantes) {
      const s = parFormat.get(g.formatLibelle) ?? new Set<string>();
      s.add(g.prix);
      parFormat.set(g.formatLibelle, s);
    }
    const rappelGrille = [...parFormat.entries()].map(([formatLibelle, prix]) => ({
      formatLibelle,
      prix: prix.size === 1 ? [...prix][0]! : "variable",
    }));

    // Agrégats réalisés.
    let volume = 0;
    let ca = new Decimal(0);
    let cout = new Decimal(0);
    for (const cmd of c.commandes) {
      for (const l of cmd.lignes) {
        volume += l.qte;
        cout = cout.plus(new Decimal(l.coutUnitFige.toString()).mul(l.qte));
        if (!l.offert) ca = ca.plus(new Decimal(l.puHT.toString()).mul(l.qte));
      }
    }

    return {
      id: c.id,
      nom: c.nom,
      ville: c.ville,
      roles: c.roles.map((r) => r.role),
      rappelGrille,
      volumeCumule: volume,
      tauxMarqueMoyen: ca.isZero() ? null : ca.minus(cout).div(ca),
    };
  });
}
