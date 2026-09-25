/** Initialisation Mercura : référentiel fourni, sans inventer de coûts ni de tarifs. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dateEffet = new Date("2000-01-01T00:00:00.000Z");

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const [cle, valeur] of [
      ["taux_perte", "0"],
      ["tva_recuperable", "1"],
      ["frais_livraison", "0"],
      ["frais_livraison_ttc", "0"],
      ["livraison_nb_pieces", "0"],
    ] as const) {
      await tx.parametre.upsert({
        where: { cle_dateEffet: { cle, dateEffet } },
        update: {},
        create: { cle, valeur, dateEffet },
      });
    }
    const boutique = await tx.client.upsert({
      where: { nom: "Boutique en ligne" },
      update: {},
      create: { nom: "Boutique en ligne" },
    });
    await tx.clientRole.upsert({
      where: { clientId_role: { clientId: boutique.id, role: "D2C" } },
      update: {},
      create: { clientId: boutique.id, role: "D2C" },
    });

    const formats = await Promise.all([
      tx.format.upsert({ where: { libelle: "50 ml" }, update: {}, create: { libelle: "50 ml", volumeL: "0.05" } }),
      tx.format.upsert({ where: { libelle: "2 ml" }, update: {}, create: { libelle: "2 ml", volumeL: "0.002" } }),
    ]);
    // Zéro indique ici « prix du liquide non communiqué » ; aucune ligne de
    // PrixLiquide, Composant, Faconnage ou GrillePrix n'est créée par le seed.
    const parfums = await Promise.all([
      tx.parfum.upsert({ where: { nom: "Alabama Cookie" }, update: {}, create: { nom: "Alabama Cookie", prixLiquideL: "0" } }),
      tx.parfum.upsert({ where: { nom: "Buffalo Coffee" }, update: {}, create: { nom: "Buffalo Coffee", prixLiquideL: "0" } }),
    ]);
    const skus = [
      ["ALABAMA-COOKIE-50ML", parfums[0]!.id, formats[0]!.id],
      ["ALABAMA-COOKIE-2ML", parfums[0]!.id, formats[1]!.id],
      ["BUFFALO-COFFEE-50ML", parfums[1]!.id, formats[0]!.id],
      ["BUFFALO-COFFEE-2ML", parfums[1]!.id, formats[1]!.id],
    ] as const;
    for (const [sku, parfumId, formatId] of skus) {
      await tx.produit.upsert({
        where: { parfumId_formatId: { parfumId, formatId } },
        update: {},
        create: { sku, parfumId, formatId },
      });
    }
  });
}

main().finally(() => prisma.$disconnect());
