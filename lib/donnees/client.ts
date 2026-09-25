import type { RoleClient, StatutCommande } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Decimal, valeurAuJour } from "@/lib/calcul";

export interface LigneGrilleFiche {
  produitId: string;
  parfumNom: string;
  formatLibelle: string;
  sku: string;
  prixCourant: string | null;
  historique: { prix: string; dateEffet: string }[];
}

export interface CommandeResume {
  id: string;
  reference: string;
  date: string; // ISO
  statut: StatutCommande;
  caHT: Decimal;
  margeBrute: Decimal;
}

export interface FicheClient {
  id: string;
  nom: string;
  contact: string | null;
  email: string | null;
  ville: string | null;
  notes: string | null;
  roles: RoleClient[];
  grille: LigneGrilleFiche[];
  commandes: CommandeResume[];
  margeCumulee: Decimal;
  caCumule: Decimal;
}

/** Fiche client (§8.5) : grille datée par produit, commandes, marge cumulée. */
export async function chargerFicheClient(
  clientId: string,
  date: Date = new Date(),
): Promise<FicheClient | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      roles: true,
      grille: true,
      commandes: {
        include: { lignes: true },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!client) return null;

  const produits = await prisma.produit.findMany({
    where: { actif: true },
    include: { parfum: true, format: true },
    orderBy: [{ format: { libelle: "desc" } }, { parfum: { nom: "asc" } }],
  });

  const grille: LigneGrilleFiche[] = produits.map((p) => {
    const lignes = client.grille
      .filter((g) => g.produitId === p.id)
      .map((g) => ({ prix: g.prixCessionHT.toString(), dateEffet: g.dateEffet }));
    const courant = valeurAuJour(lignes, date);
    return {
      produitId: p.id,
      parfumNom: p.parfum.nom,
      formatLibelle: p.format.libelle,
      sku: p.sku,
      prixCourant: courant?.prix ?? null,
      historique: lignes
        .sort((a, b) => b.dateEffet.getTime() - a.dateEffet.getTime())
        .map((l) => ({ prix: l.prix, dateEffet: l.dateEffet.toISOString() })),
    };
  });

  let margeCumulee = new Decimal(0);
  let caCumule = new Decimal(0);
  const commandes: CommandeResume[] = client.commandes.map((cmd) => {
    let ca = new Decimal(0);
    let cout = new Decimal(0);
    for (const l of cmd.lignes) {
      cout = cout.plus(new Decimal(l.coutUnitFige.toString()).mul(l.qte));
      if (!l.offert) ca = ca.plus(new Decimal(l.puHT.toString()).mul(l.qte));
    }
    const marge = ca.minus(cout);
    if (cmd.statut === "CONFIRMEE" || cmd.statut === "LIVREE") {
      margeCumulee = margeCumulee.plus(marge);
      caCumule = caCumule.plus(ca);
    }
    return {
      id: cmd.id,
      reference: cmd.reference,
      date: cmd.date.toISOString(),
      statut: cmd.statut,
      caHT: ca,
      margeBrute: marge,
    };
  });

  return {
    id: client.id,
    nom: client.nom,
    contact: client.contact,
    email: client.email,
    ville: client.ville,
    notes: client.notes,
    roles: client.roles.map((r) => r.role),
    grille,
    commandes,
    margeCumulee,
    caCumule,
  };
}
