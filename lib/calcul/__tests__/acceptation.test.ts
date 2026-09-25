import { describe, expect, it } from "vitest";
import { agregatsCommande, analyseMargeSurCout, decompositionCout, moyenneGammeDepuisContextes } from "../index";
import type { ProduitContexte } from "../types";

const debut = new Date("2025-01-01T00:00:00Z");
const suite = new Date("2025-06-01T00:00:00Z");
const contexte: ProduitContexte = {
  volumeL: "0.03",
  prixLiquideL: "90",
  prixLiquides: [
    { prixLitreHT: "100", dateEffet: debut },
    { prixLitreHT: "144", tvaIncluse: true, dateEffet: suite },
  ],
  parametres: [
    { cle: "taux_perte", valeur: "0.1", dateEffet: debut },
    { cle: "tva_recuperable", valeur: "1", dateEffet: debut },
    { cle: "frais_livraison", valeur: "120", dateEffet: debut },
    { cle: "livraison_nb_pieces", valeur: "100", dateEffet: debut },
  ],
  composants: [
    { libelle: "Flacon", coutUnitHT: "2", optionnel: false, dateEffet: debut },
    { libelle: "Flacon", coutUnitHT: "3", optionnel: false, dateEffet: suite },
    { libelle: "Ruban", coutUnitHT: "0.5", optionnel: true, dateEffet: debut },
    { libelle: "Remplissage", coutUnitHT: "0.8", optionnel: false, faconnage: true, dateEffet: debut },
  ],
  faconnages: [{ coutFixeSerie: "60", coutVarUnitHT: "0.4", qteLotRef: 100, dateEffet: debut }],
  coutsVariables: [{ libelle: "Douane", montant: "60", dateEffet: debut }],
};

describe("scénarios synthétiques du moteur Mercura", () => {
  it("résout les valeurs à la date et répartit les coûts sans arrondi intermédiaire", () => {
    const janvier = decompositionCout(contexte, new Date("2025-02-01"));
    expect(janvier.liquide.toString()).toBe("3.3");
    expect(janvier.conditionnement.toString()).toBe("2");
    expect(janvier.faconnage.toString()).toBe("1.8");
    expect(janvier.livraison.toString()).toBe("1.8");
    expect(janvier.complet.toString()).toBe("8.9");
    const juillet = decompositionCout(contexte, new Date("2025-07-01"));
    expect(juillet.liquide.toString()).toBe("3.96");
    expect(juillet.conditionnement.toString()).toBe("3");
    expect(juillet.complet.toString()).toBe("10.56");
    expect(decompositionCout(contexte, new Date("2025-07-01"), { qteLot: 20 }).faconnage.toString()).toBe("4.2");
  });

  it("n'inclut les options qu'à la demande et respecte la TVA non récupérable", () => {
    const option = decompositionCout(contexte, new Date("2025-02-01"), { avecOptionnels: true });
    expect(option.conditionnement.toString()).toBe("2.5");
    const franchise: ProduitContexte = { ...contexte, parametres: [...contexte.parametres, { cle: "tva_recuperable", valeur: "0", dateEffet: suite }] };
    expect(decompositionCout(franchise, new Date("2025-07-01")).liquide.toString()).toBe("4.752");
  });

  it("utilise le coût réel de chaque produit pour la marge", () => {
    const cout = decompositionCout(contexte, new Date("2025-02-01")).complet;
    const moyenne = moyenneGammeDepuisContextes([contexte, { ...contexte, volumeL: "0.01" }], new Date("2025-02-01"));
    expect(moyenne.lt(cout)).toBe(true);
    const marge = analyseMargeSurCout("20", cout);
    expect(marge.marge.toString()).toBe("11.1");
    expect(marge.tauxMarque.toString()).toBe("0.555");
    expect(marge.coefficient.mul(cout).toString()).toBe("20");
  });

  it("compte les unités offertes dans le coût mais pas dans le chiffre d'affaires", () => {
    const resultat = agregatsCommande([
      { qte: 3, puHT: "20", coutUnitFige: "8.9", offert: false },
      { qte: 1, puHT: "20", coutUnitFige: "8.9", offert: true },
    ], [{ montantHT: "4.4" }]);
    expect(resultat.caHT.toString()).toBe("60");
    expect(resultat.coutRevient.toString()).toBe("35.6");
    expect(resultat.margeNette.toString()).toBe("20");
  });
});
