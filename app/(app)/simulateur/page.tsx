import { chargerCatalogue } from "@/lib/donnees/produits";
import {
  SimulateurCatalogue,
  type ProduitSimulable,
} from "@/components/produit/SimulateurCatalogue";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PageSimulateur() {
  const lignes = await chargerCatalogue();
  // Tri par coût complet décroissant, comme le catalogue (§8.2).
  lignes.sort((a, b) => b.decomposition.complet.comparedTo(a.decomposition.complet));

  const produits: ProduitSimulable[] = lignes.filter((l) => l.prixLiquideRenseigne).map((l) => ({
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
        {produits.length === 0 && lignes.length > 0
          ? <p className="mt-8 text-[14px] text-lecture">Les références sont créées. Renseignez d&apos;abord leur prix du liquide et leurs coûts par format dans le <Link href="/parametres" className="lien-discret">Registre des coûts</Link> pour les simuler.</p>
          : <SimulateurCatalogue produits={produits} />}
      </div>
    </div>
  );
}
