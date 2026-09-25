-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "mercura";

-- CreateEnum
CREATE TYPE "RoleClient" AS ENUM ('DISTRIBUTEUR', 'REVENDEUR', 'CORNER', 'D2C', 'PROSPECT');

-- CreateEnum
CREATE TYPE "SourceCommande" AS ENUM ('MANUEL', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('BROUILLON', 'CONFIRMEE', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "RattachementCharge" AS ENUM ('COMMANDE', 'GLOBALE');

-- CreateEnum
CREATE TYPE "PeriodiciteCharge" AS ENUM ('PONCTUELLE', 'MENSUELLE', 'ANNUELLE');

-- CreateEnum
CREATE TYPE "StatutImport" AS ENUM ('PREVISUALISATION', 'APPLIQUE', 'ANNULE');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parfum" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prixLiquideL" DECIMAL(10,4) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parfum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrixLiquide" (
    "id" TEXT NOT NULL,
    "parfumId" TEXT NOT NULL,
    "prixLitreHT" DECIMAL(10,4) NOT NULL,
    "litresCommandes" DECIMAL(10,3),
    "tvaIncluse" BOOLEAN NOT NULL DEFAULT false,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrixLiquide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoutVariable" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "tvaIncluse" BOOLEAN NOT NULL DEFAULT false,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoutVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodeCouts" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodeCouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Format" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "volumeL" DECIMAL(10,5) NOT NULL,

    CONSTRAINT "Format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionPaquet" (
    "id" TEXT NOT NULL,
    "elements" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompositionPaquet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "parfumId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "skuShopify" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composant" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "coutUnitHT" DECIMAL(10,4) NOT NULL,
    "optionnel" BOOLEAN NOT NULL DEFAULT false,
    "qteCommandee" INTEGER,
    "tvaIncluse" BOOLEAN NOT NULL DEFAULT false,
    "faconnage" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faconnage" (
    "id" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "coutFixeSerie" DECIMAL(10,2) NOT NULL,
    "coutVarUnitHT" DECIMAL(10,4) NOT NULL,
    "qteLotRef" INTEGER NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faconnage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" DECIMAL(10,5) NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "ville" TEXT,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRole" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "RoleClient" NOT NULL,

    CONSTRAINT "ClientRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrancheTarifaire" (
    "id" TEXT NOT NULL,
    "role" "RoleClient" NOT NULL,
    "libelle" TEXT NOT NULL,
    "qteMin" INTEGER NOT NULL,
    "qteMax" INTEGER,
    "prixUnitHT" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrancheTarifaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrillePrix" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "prixCessionHT" DECIMAL(10,2) NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrillePrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'BROUILLON',
    "source" "SourceCommande" NOT NULL DEFAULT 'MANUEL',
    "idShopify" TEXT,
    "notes" TEXT,
    "confirmeLe" TIMESTAMP(3),
    "dateCouts" TIMESTAMP(3),

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommande" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "qte" INTEGER NOT NULL,
    "puHT" DECIMAL(10,2) NOT NULL,
    "offert" BOOLEAN NOT NULL DEFAULT false,
    "coutUnitFige" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantHT" DECIMAL(10,2) NOT NULL,
    "rattachement" "RattachementCharge" NOT NULL,
    "periodicite" "PeriodiciteCharge" NOT NULL DEFAULT 'PONCTUELLE',
    "commandeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeCible" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "statut" "StatutImport" NOT NULL DEFAULT 'PREVISUALISATION',
    "lignesOk" INTEGER NOT NULL DEFAULT 0,
    "lignesErreur" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglageShopify" (
    "id" TEXT NOT NULL,
    "domaine" TEXT,
    "jetonChiffre" TEXT,
    "commissionTauxPct" DECIMAL(6,4) NOT NULL DEFAULT 1.4,
    "commissionFixe" DECIMAL(10,4) NOT NULL DEFAULT 0.25,
    "historiqueComplet" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglageShopify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuAMapper" (
    "id" TEXT NOT NULL,
    "idShopify" TEXT NOT NULL,
    "skuShopify" TEXT NOT NULL,
    "libelle" TEXT,
    "qte" INTEGER NOT NULL,
    "puTTC" DECIMAL(10,2) NOT NULL,
    "payload" JSONB NOT NULL,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "produitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuAMapper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Parfum_nom_key" ON "Parfum"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "PrixLiquide_parfumId_dateEffet_key" ON "PrixLiquide"("parfumId", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "CoutVariable_libelle_dateEffet_key" ON "CoutVariable"("libelle", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodeCouts_dateEffet_key" ON "PeriodeCouts"("dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "Format_libelle_key" ON "Format"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_sku_key" ON "Produit"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_parfumId_formatId_key" ON "Produit"("parfumId", "formatId");

-- CreateIndex
CREATE UNIQUE INDEX "Parametre_cle_dateEffet_key" ON "Parametre"("cle", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "Client_nom_key" ON "Client"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRole_clientId_role_key" ON "ClientRole"("clientId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "GrillePrix_clientId_produitId_dateEffet_key" ON "GrillePrix"("clientId", "produitId", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_reference_key" ON "Commande"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_idShopify_key" ON "Commande"("idShopify");

-- CreateIndex
CREATE INDEX "SkuAMapper_resolu_idx" ON "SkuAMapper"("resolu");

-- AddForeignKey
ALTER TABLE "PrixLiquide" ADD CONSTRAINT "PrixLiquide_parfumId_fkey" FOREIGN KEY ("parfumId") REFERENCES "Parfum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_parfumId_fkey" FOREIGN KEY ("parfumId") REFERENCES "Parfum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composant" ADD CONSTRAINT "Composant_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faconnage" ADD CONSTRAINT "Faconnage_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRole" ADD CONSTRAINT "ClientRole_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrillePrix" ADD CONSTRAINT "GrillePrix_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrillePrix" ADD CONSTRAINT "GrillePrix_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkuAMapper" ADD CONSTRAINT "SkuAMapper_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
