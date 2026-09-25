import { Decimal, valeurAuJour } from "@/lib/calcul";
import { chargerCatalogue, type LigneCatalogue } from "./produits";

export interface FaconnageApplicable {
  coutFixeSerie: string;
  coutVarUnitHT: string;
  qteLotRef: number;
}

export interface FicheProduit extends LigneCatalogue {
  faconnage: FaconnageApplicable | null;
  prixReference: Decimal | null;
}

/** Charge une fiche produit complète à la date, avec le façonnage applicable. */
export async function chargerFicheProduit(
  produitId: string,
  date: Date = new Date(),
): Promise<FicheProduit | null> {
  const catalogue = await chargerCatalogue(date);
  const ligne = catalogue.find((l) => l.produitId === produitId);
  if (!ligne) return null;

  const facRows = ligne.contexte.faconnages.map((f) => ({
    ...f,
    dateEffet: f.dateEffet,
  }));
  const fac = valeurAuJour(facRows, date);

  return {
    ...ligne,
    faconnage: fac
      ? {
          coutFixeSerie: String(fac.coutFixeSerie),
          coutVarUnitHT: String(fac.coutVarUnitHT),
          qteLotRef: fac.qteLotRef,
        }
      : null,
  };
}
