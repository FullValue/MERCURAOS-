import type { EtatParametres } from "@/lib/donnees/parametres";
import { decompositionCout } from "./cout";
import { Decimal, dSaisie } from "./decimal";

/** Aperçu du registre : exactement les mêmes postes et règles que le catalogue. */
export function moyennesRegistre(etat: EtatParametres): Map<string, Decimal> {
  const dateEffet = new Date("2000-01-01T00:00:00Z");
  return new Map(etat.formats.map((format) => {
    const fac = etat.faconnages.find((f) => f.formatId === format.id);
    const somme = etat.prixLiquides.reduce((acc, prix) => acc.plus(decompositionCout({
      volumeL: format.volumeL,
      prixLiquideL: "0",
      prixLiquides: [{ prixLitreHT: dSaisie(prix.prixLitreHT), tvaIncluse: prix.tvaIncluse, dateEffet }],
      composants: etat.composants.filter((c) => c.formatId === format.id).map((c) => ({ ...c, coutUnitHT: dSaisie(c.coutUnitHT), dateEffet })),
      faconnages: fac ? [{ ...fac, qteLotRef: Math.max(1, fac.qteLotRef), dateEffet }] : [],
      coutsVariables: etat.coutsVariables.map((c) => ({ ...c, montant: dSaisie(c.montant), dateEffet })),
      parametres: [
        { cle: "taux_perte", valeur: dSaisie(etat.tauxPerte), dateEffet },
        { cle: "frais_livraison", valeur: dSaisie(etat.fraisLivraison), dateEffet },
        { cle: "frais_livraison_ttc", valeur: etat.fraisLivraisonTtc ? "1" : "0", dateEffet },
        { cle: "livraison_nb_pieces", valeur: dSaisie(etat.livraisonNbPieces), dateEffet },
        { cle: "tva_recuperable", valeur: etat.tvaRecuperable ? "1" : "0", dateEffet },
      ],
    }, dateEffet).complet), new Decimal(0));
    return [format.id, somme.div(etat.prixLiquides.length || 1)];
  }));
}
