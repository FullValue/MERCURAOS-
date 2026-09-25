/** Initialisation Mercura : paramètres génériques et client technique Shopify. */
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
  });
}

main().finally(() => prisma.$disconnect());
