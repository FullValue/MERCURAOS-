import { describe, expect, it } from "vitest";
import { compositionParDefaut, coutPaquet, optionsFormats } from "@/lib/paquet";

describe("composition du paquet", () => {
  const lignes = [
    { formatId: "50", formatLibelle: "50 ml" },
    { formatId: "10", formatLibelle: "10 ml" },
    { formatId: "2", formatLibelle: "2 ml" },
  ];
  const produits = [
    { parfumNom: "Parfum test", formatId: "50", cout: "7" },
    { parfumNom: "Parfum test", formatId: "10", cout: "3" },
    { parfumNom: "Parfum test", formatId: "2", cout: "1" },
  ];
  const composants = [{ formatId: "50", libelle: "Sac", cout: "0.5" }];

  it("préserve la composition initiale et accepte le 2 ml", () => {
    const initiale = compositionParDefaut([
      ...optionsFormats(lignes),
      { type: "composant", formatId: "50", libelle: "Sac", nom: "Sac" },
    ]);
    expect(coutPaquet(initiale, "Parfum test", produits, composants)?.toString()).toBe("10.5");
    expect(coutPaquet([...initiale, { type: "format", formatId: "2", quantite: 2 }], "Parfum test", produits, composants)?.toString()).toBe("12.5");
    expect(coutPaquet(initiale.filter((e) => e.type !== "composant"), "Parfum test", produits, composants)?.toString()).toBe("10");
  });

  it("ne donne pas de total si un format manque pour ce parfum", () => {
    expect(coutPaquet([{ type: "format", formatId: "2", quantite: 1 }], "Autre", produits, composants)).toBeNull();
  });
});
