import { prisma } from "@/lib/db";
import { ImportAssistant } from "@/components/import/ImportAssistant";
import { HistoriqueImports } from "@/components/import/HistoriqueImports";

export const dynamic = "force-dynamic";

export default async function PageImport() {
  const imports = await prisma.import.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">Import</h1>
      <p className="mt-2 text-[15px] text-lecture">
        Dépôt, mapping, prévisualisation obligatoire, application. Chaque import
        appliqué reste annulable.
      </p>

      <div className="mt-12">
        <ImportAssistant />
      </div>

      <section className="mt-12 border-t border-filet pt-8">
        <h2 className="font-titre text-[24px] font-light text-encre">
          Historique des imports
        </h2>
        <div className="mt-6">
          <HistoriqueImports
            imports={imports.map((i) => ({
              id: i.id,
              nomFichier: i.nomFichier,
              typeCible: i.typeCible,
              statut: i.statut,
              lignesOk: i.lignesOk,
              lignesErreur: i.lignesErreur,
              createdAt: i.createdAt.toISOString(),
            }))}
          />
        </div>
      </section>
    </div>
  );
}
