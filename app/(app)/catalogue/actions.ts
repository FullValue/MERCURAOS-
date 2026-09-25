"use server";

import { z } from "zod";
import { exigerUtilisateur } from "@/lib/auth";
import { erreurAction, revaliderApplication } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { cleElement, type ElementPaquet } from "@/lib/paquet";

const schemaElement = z.discriminatedUnion("type", [
  z.object({ type: z.literal("format"), formatId: z.string().uuid(), quantite: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal("composant"), formatId: z.string().uuid(), libelle: z.string().min(1).max(60), quantite: z.number().int().min(1).max(100) }),
]);
const schemaComposition = z.array(schemaElement).min(1).max(30);

/** Configuration partagée du paquet, indépendante de la période de coûts. */
export async function enregistrerCompositionPaquet(entree: ElementPaquet[]): Promise<{ ok: boolean; message: string }> {
  await exigerUtilisateur();
  try {
    const validation = schemaComposition.safeParse(entree);
    if (!validation.success) return { ok: false, message: "Ajoutez au moins un élément valide au paquet (quantité de 1 à 100)." };
    const elements = validation.data;
    const cles = elements.map(cleElement);
    if (new Set(cles).size !== cles.length) return { ok: false, message: "Un même élément ne peut figurer qu'une fois." };

    const [produits, composants] = await Promise.all([
      prisma.produit.findMany({ where: { actif: true }, select: { formatId: true } }),
      prisma.composant.findMany({ where: { optionnel: true, faconnage: false }, select: { formatId: true, libelle: true } }),
    ]);
    const formatsValides = new Set(produits.map((p) => p.formatId));
    const composantsValides = new Set(composants.map((c) => cleElement({ type: "composant", formatId: c.formatId, libelle: c.libelle })));
    if (elements.some((e) => e.type === "format" ? !formatsValides.has(e.formatId) : !composantsValides.has(cleElement(e)))) {
      return { ok: false, message: "Un format ou un élément n'est plus disponible. Actualisez la page." };
    }
    await prisma.compositionPaquet.upsert({
      where: { id: "principal" },
      create: { id: "principal", elements },
      update: { elements },
    });
    revaliderApplication();
    return { ok: true, message: "Composition du paquet enregistrée." };
  } catch (e) { return erreurAction(e); }
}
