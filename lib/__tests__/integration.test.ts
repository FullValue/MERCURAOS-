import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ exigerUtilisateur: vi.fn(async () => ({ id: "test", email: "test@example.invalid" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "../db";
import { exigerUtilisateur } from "../auth";
import { revalidatePath } from "next/cache";
import { enregistrerCommande, confirmerCommande, rouvrirCommande, supprimerCommande, changerStatut } from "@/app/(app)/commandes/actions";
import { ajouterChargeGlobale, supprimerChargeGlobale } from "@/app/(app)/synthese/actions";
import { appliquerImport, annulerImport } from "@/app/(app)/import/actions";
import { enregistrerParametres, creerFormat, creerParfum, creerProduit, modifierProduit } from "@/app/(app)/parametres/actions";
import { enregistrerCompositionPaquet } from "@/app/(app)/catalogue/actions";
import { chargerSynthese } from "../donnees/synthese";
import { chargerDonneesEditeur } from "../donnees/commandes";
import { decompositionCout } from "../calcul";
import { ingererCommandeShopify, type CommandeShopify } from "../shopify/ingestion";

const actif = process.env.MERCURA_INTEGRATION === "1" && new URL(process.env.DATABASE_URL || "postgres://localhost").searchParams.get("schema")?.startsWith("mercura_test_");
describe.skipIf(!actif)("Parcours métier sur PostgreSQL isolé", () => {
  let clientId: string, produitId: string, formatId: string;
  const date = "2026-09-01";
  const entree = () => ({ clientId, date, lignes: [{ produitId, qte: 10, puHT: "50", offert: false }], charges: [{ libelle: "Transport", montantHT: "10,50" }] });
  const synthese = () => chargerSynthese(new Date("2026-01-01"), new Date("2026-12-31"));
  beforeAll(async () => {
    const format = await prisma.format.create({ data: { libelle: "50 ml", volumeL: "0.05" } }); formatId = format.id;
    const parfum = await prisma.parfum.create({ data: { nom: "Parfum test", prixLiquideL: "100" } });
    const produit = await prisma.produit.create({ data: { parfumId: parfum.id, formatId, sku: "TEST-50" } }); produitId = produit.id;
    const client = await prisma.client.create({ data: { nom: "Client test" } }); clientId = client.id;
    await prisma.client.create({ data: { nom: "Boutique en ligne" } });
    await prisma.composant.create({ data: { formatId, libelle: "Flacon", coutUnitHT: "2", dateEffet: new Date("2026-01-01") } });
    await prisma.faconnage.create({ data: { formatId, coutFixeSerie: "100", coutVarUnitHT: "1", qteLotRef: 100, dateEffet: new Date("2026-01-01") } });
    await prisma.parametre.create({ data: { cle: "frais_livraison", valeur: "120", dateEffet: new Date("2026-01-01") } });
  });
  beforeEach(async () => {
    await prisma.import.deleteMany(); await prisma.commande.deleteMany(); await prisma.charge.deleteMany(); await prisma.compositionPaquet.deleteMany();
    vi.mocked(exigerUtilisateur).mockResolvedValue({ id: "test", email: "test@example.invalid", isAdmin: false, createdAt: new Date() });
    vi.mocked(revalidatePath).mockClear();
  });
  it("enregistre la composition du paquet avec un format 2 ml et refuse les éléments invalides", async () => {
    const f2 = await prisma.format.create({ data: { libelle: "2 ml", volumeL: "0.002" } });
    const parfum = await prisma.parfum.findFirstOrThrow({ where: { nom: "Parfum test" } });
    await prisma.produit.create({ data: { parfumId: parfum.id, formatId: f2.id, sku: "TEST-2" } });
    const sac = await prisma.composant.create({ data: { formatId, libelle: "Sac", coutUnitHT: "0.26", optionnel: true, dateEffet: new Date(date) } });
    const contenu = [
      { type: "format" as const, formatId, quantite: 1 },
      { type: "format" as const, formatId: f2.id, quantite: 2 },
      { type: "composant" as const, formatId, libelle: "Sac", quantite: 1 },
    ];
    expect((await enregistrerCompositionPaquet(contenu)).ok).toBe(true);
    expect((await prisma.compositionPaquet.findUniqueOrThrow({ where: { id: "principal" } })).elements).toEqual(contenu);
    expect((await enregistrerCompositionPaquet([{ type: "format", formatId: "00000000-0000-0000-0000-000000000000", quantite: 1 }])).ok).toBe(false);
    expect((await enregistrerCompositionPaquet([contenu[0]!, contenu[0]!])).ok).toBe(false);
    expect((await enregistrerCompositionPaquet([{ type: "format", formatId: f2.id, quantite: 1 }])).ok).toBe(true);
    expect((await prisma.compositionPaquet.findUniqueOrThrow({ where: { id: "principal" } })).elements).toEqual([{ type: "format", formatId: f2.id, quantite: 1 }]);
    await prisma.produit.deleteMany({ where: { formatId: f2.id } });
    await prisma.composant.delete({ where: { id: sac.id } });
    await prisma.format.delete({ where: { id: f2.id } });
  });
  it("crée le référentiel Mercura sans données commerciales préchargées", async () => {
    expect((await creerFormat({ libelle: "30 ml test", volumeMl: "30" })).ok).toBe(true);
    expect((await creerParfum({ nom: "Essai olfactif", prixLiquideL: "96,5" })).ok).toBe(true);
    const format = await prisma.format.findUniqueOrThrow({ where: { libelle: "30 ml test" } });
    const parfum = await prisma.parfum.findUniqueOrThrow({ where: { nom: "Essai olfactif" } });
    expect(format.volumeL.toString()).toBe("0.03");
    expect((await creerProduit({ parfumId: parfum.id, formatId: format.id, sku: "ESSAI-30", skuShopify: "SHOP-30" })).ok).toBe(true);
    const produit = await prisma.produit.findUniqueOrThrow({ where: { sku: "ESSAI-30" } });
    expect((await modifierProduit({ id: produit.id, sku: "ESSAI-30-B", skuShopify: "SHOP-30", actif: false })).ok).toBe(true);
    expect((await prisma.produit.findUniqueOrThrow({ where: { id: produit.id } })).actif).toBe(false);
    expect((await creerProduit({ parfumId: parfum.id, formatId: format.id, sku: "AUTRE-30" })).ok).toBe(false);
  });
  afterAll(async () => { await prisma.$disconnect(); });
  it("crée, modifie, confirme, livre, rouvre, annule et supprime avec synthèse cohérente", async () => {
    const creation = await enregistrerCommande(entree()); expect(creation.ok).toBe(true);
    const id = creation.id!;
    expect((await synthese()).caHT.toString()).toBe("0");
    const edition = await chargerDonneesEditeur(new Date(date));
    const apercu = decompositionCout(edition.produits.find((p) => p.produitId === produitId)!.contexte, new Date(date), { qteLot: 10 });
    expect(apercu.complet.toString()).toBe("30");
    expect((await prisma.ligneCommande.findFirstOrThrow()).coutUnitFige.toString()).toBe(apercu.complet.toString());
    expect((await confirmerCommande(id)).ok).toBe(true);
    let s = await synthese(); expect(s.caHT.toString()).toBe("500"); expect(s.coutRevient.toString()).toBe("300"); expect(s.margeNette.toString()).toBe("189.5");
    expect((await enregistrerCommande({ ...entree(), commandeId: id })).ok).toBe(false);
    expect((await changerStatut(id, "LIVREE")).ok).toBe(true);
    expect((await rouvrirCommande(id)).ok).toBe(true);
    expect((await synthese()).caHT.toString()).toBe("0");
    const e = entree(); e.lignes[0]!.qte = 20;
    expect((await enregistrerCommande({ ...e, commandeId: id })).ok).toBe(true);
    expect((await confirmerCommande(id)).ok).toBe(true);
    s = await synthese(); expect(s.caHT.toString()).toBe("1000"); expect(s.coutRevient.toString()).toBe("380");
    expect((await changerStatut(id, "ANNULEE")).ok).toBe(true);
    expect((await synthese()).caHT.toString()).toBe("0");
    expect((await supprimerCommande(id)).ok).toBe(true);
    expect(await prisma.ligneCommande.count()).toBe(0); expect(await prisma.charge.count()).toBe(0);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("conserve le gel des coûts après changement du registre", async () => {
    const { id } = await enregistrerCommande(entree()); await confirmerCommande(id!);
    const avant = (await prisma.ligneCommande.findFirstOrThrow()).coutUnitFige.toString();
    await prisma.composant.updateMany({ data: { coutUnitHT: "3" } });
    expect((await prisma.ligneCommande.findFirstOrThrow()).coutUnitFige.toString()).toBe(avant);
    await rouvrirCommande(id!); await confirmerCommande(id!);
    expect((await prisma.ligneCommande.findFirstOrThrow()).coutUnitFige.toString()).toBe("31");
    await prisma.composant.updateMany({ data: { coutUnitHT: "2" } });
  });
  it("annule toute modification si une relation est invalide", async () => {
    const { id } = await enregistrerCommande(entree());
    const r = await enregistrerCommande({ ...entree(), commandeId: id, clientId: "inexistant", charges: [] });
    expect(r.ok).toBe(false); expect(await prisma.ligneCommande.count()).toBe(1); expect(await prisma.charge.count()).toBe(1);
  });
  it("n'alloue pas deux fois une référence lors de créations simultanées", async () => {
    const rs = await Promise.all([enregistrerCommande(entree()), enregistrerCommande(entree()), enregistrerCommande(entree())]);
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(new Set((await prisma.commande.findMany()).map((c) => c.reference)).size).toBe(3);
  });
  it("refuse les statuts, dates, quantités et prix invalides", async () => {
    expect((await enregistrerCommande({ ...entree(), date: "2026-02-31" })).ok).toBe(false);
    expect((await enregistrerCommande({ ...entree(), lignes: [{ produitId, qte: 0, puHT: "Infinity", offert: false }] })).ok).toBe(false);
    expect((await changerStatut("absent", "CONFIRMEE" as "LIVREE")).ok).toBe(false);
    expect(await prisma.commande.count()).toBe(0);
  });
  it("exige une session avant toute mutation", async () => {
    vi.mocked(exigerUtilisateur).mockRejectedValueOnce(new Error("session requise"));
    await expect(enregistrerCommande(entree())).rejects.toThrow("session requise");
    expect(await prisma.commande.count()).toBe(0);
  });
  it("accepte une charge française et protège les charges rattachées", async () => {
    expect((await ajouterChargeGlobale({ libelle: "Loyer", montantHT: "123,45", periodicite: "PONCTUELLE", date })).ok).toBe(true);
    expect((await synthese()).chargesFixes.toString()).toBe("123.45");
    await enregistrerCommande(entree());
    const charge = await prisma.charge.findFirstOrThrow({ where: { rattachement: "COMMANDE" } });
    expect((await supprimerChargeGlobale(charge.id)).ok).toBe(false);
  });
  it("refuse de fusionner deux composants par renommage", async () => {
    const autre = await prisma.composant.create({ data: { formatId, libelle: "Boîte", coutUnitHT: "1", dateEffet: new Date(date) } });
    expect((await enregistrerParametres({ renommages: [{ formatId, ancienLibelle: "Flacon", nouveauLibelle: "Boîte" }] })).ok).toBe(false);
    expect(await prisma.composant.count({ where: { libelle: "Flacon" } })).toBe(1);
    await prisma.composant.delete({ where: { id: autre.id } });
  });
  const importEntree = () => ({ typeCible: "commandes", nomFichier: "test.csv", mapping: {}, choix: {}, lignes: [{ reference: "IMPORT-1", client: "Client test", date, sku: "TEST-50", qte: "2", puHT: "50" }] });
  it("importe et annule atomiquement, sans effacer une vente confirmée", async () => {
    expect((await appliquerImport(importEntree())).ok).toBe(true);
    const imp = await prisma.import.findFirstOrThrow(); const cmd = await prisma.commande.findFirstOrThrow();
    await confirmerCommande(cmd.id);
    expect((await annulerImport(imp.id)).ok).toBe(false);
    await rouvrirCommande(cmd.id);
    expect((await annulerImport(imp.id)).ok).toBe(true); expect(await prisma.commande.count()).toBe(0);
  });
  it("ne laisse aucun import partiel si la deuxième commande est incohérente", async () => {
    const e = importEntree(); const ligne = e.lignes[0]!;
    e.lignes.push({ ...ligne, reference: "IMPORT-2" }, { ...ligne, reference: "IMPORT-2", date: "2026-09-02" });
    expect((await appliquerImport(e)).ok).toBe(false);
    expect(await prisma.commande.count()).toBe(0); expect(await prisma.import.count()).toBe(0);
  });
  it("Shopify : remise, TVA, idempotence et remboursement daté", async () => {
    const commande: CommandeShopify = { id: 123, order_number: 123, created_at: `${date}T12:00:00Z`, taxes_included: true,
      current_total_price: "108", total_tax: "18", line_items: [{ id: 1, sku: "TEST-50", title: "Test", quantity: 2, price: "60", tax_lines: [{ rate: 0.2 }], discount_allocations: [{ amount: "12" }] }] };
    expect((await ingererCommandeShopify(commande)).statut).toBe("ingeree");
    expect((await ingererCommandeShopify(commande)).statut).toBe("deja_connue");
    expect(await prisma.commande.count()).toBe(1);
    expect((await synthese()).caHT.toString()).toBe("90");
    commande.refunds = [{ id: 11, created_at: "2026-09-03T12:00:00Z", refund_line_items: [{ line_item_id: 1, quantity: 1, subtotal: "45", restock_type: "no_restock" }] }];
    await ingererCommandeShopify(commande); await ingererCommandeShopify(commande);
    expect(await prisma.commande.count()).toBe(2);
    const remboursement = await prisma.commande.findUniqueOrThrow({ where: { reference: "SH-123-R11" }, include: { lignes: true } });
    expect(remboursement.date.toISOString()).toBe("2026-09-03T12:00:00.000Z");
    expect(remboursement.lignes[0]!.coutUnitFige.toString()).toBe("0");
    expect((await synthese()).caHT.toString()).toBe("45");
  });
});
