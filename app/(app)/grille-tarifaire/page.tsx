import { prisma } from "@/lib/db";
import {
  GrilleTarifaireEditeur,
  type TrancheLigne,
} from "@/components/tarifs/GrilleTarifaireEditeur";

export const dynamic = "force-dynamic";

export default async function PageGrilleTarifaire() {
  const rows = await prisma.trancheTarifaire.findMany({
    orderBy: [{ role: "asc" }, { libelle: "asc" }, { qteMin: "asc" }],
  });

  const tranches: TrancheLigne[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    libelle: r.libelle,
    qteMin: String(r.qteMin),
    qteMax: r.qteMax === null ? "" : String(r.qteMax),
    prixUnitHT: r.prixUnitHT.toString(),
    notes: r.notes ?? "",
  }));

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">
        Grille tarifaire
      </h1>
      <p className="mt-2 text-[15px] text-lecture">
        Tarifs de référence par tranches de quantité, pour les distributeurs et
        les revendeurs. Document commercial libre : il n&apos;est relié à aucun
        client — les grilles propres à chaque client restent sur leurs fiches.
      </p>
      <div className="mt-12">
        <GrilleTarifaireEditeur tranches={tranches} />
      </div>
    </div>
  );
}
