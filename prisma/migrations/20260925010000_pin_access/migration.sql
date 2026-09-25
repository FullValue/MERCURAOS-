CREATE TABLE "TentativePin" (
    "cle" TEXT NOT NULL,
    "essais" INTEGER NOT NULL,
    "fenetreJusqua" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TentativePin_pkey" PRIMARY KEY ("cle")
);
