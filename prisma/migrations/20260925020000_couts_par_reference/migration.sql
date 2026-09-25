-- Coûts du jus et du façonnage propres à chaque parfum et format.
CREATE TABLE "PrixLiquideReference" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "prixLitreHT" DECIMAL(10,4) NOT NULL,
    "litresCommandes" DECIMAL(10,3),
    "tvaIncluse" BOOLEAN NOT NULL DEFAULT false,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrixLiquideReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaconnageReference" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "coutFixeSerie" DECIMAL(10,2) NOT NULL,
    "coutVarUnitHT" DECIMAL(10,4) NOT NULL,
    "qteLotRef" INTEGER NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaconnageReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrixLiquideReference_produitId_dateEffet_key" ON "PrixLiquideReference"("produitId", "dateEffet");
CREATE UNIQUE INDEX "FaconnageReference_produitId_dateEffet_key" ON "FaconnageReference"("produitId", "dateEffet");

ALTER TABLE "PrixLiquideReference" ADD CONSTRAINT "PrixLiquideReference_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaconnageReference" ADD CONSTRAINT "FaconnageReference_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
