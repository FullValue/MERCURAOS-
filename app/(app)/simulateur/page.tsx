import { chargerCatalogue } from "@/lib/donnees/produits";
import {
  SimulateurCatalogue,
  type ProduitSimulable,
} from "@/components/produit/SimulateurCatalogue";

export const dynamic = "force-dynamic";

export default async function PageSimulateur() {
  const lignes = await chargerCatalogue();
  // Tri par coût complet décroissant, comme le catalogue (§8.2).
  lignes.sort((a, b) => b.decomposition.complet.comparedTo(a.decomposition.complet));

  const produits: ProduitSimulable[] = lignes.map((l) => ({
    produitId: l.produitId,
    parfumNom: l.parfumNom,
    formatLibelle: l.formatLibelle,
    coutComplet: l.decomposition.complet.toString(),
    prixReference: l.prixReference?.toString() ?? null,
  }));

  return (
    <div>
      <h1 className="font-titre text-[32px] font-light text-encre">Simulateur</h1>
      <div className="mt-2">
        <SimulateurCatalogue produits={produits} />
      </div>
    </div>
  );
}
