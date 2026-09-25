import Link from "next/link";
import { chargerDonneesEditeur } from "@/lib/donnees/commandes";
import { chargerPeriodes } from "@/lib/donnees/parametres";
import { CommandeEditeur } from "@/components/commandes/CommandeEditeur";

export const dynamic = "force-dynamic";

export default async function PageNouvelleCommande() {
  const periodes = await chargerPeriodes();
  const donnees = await chargerDonneesEditeur();

  return (
    <div>
      <Link href="/commandes" className="lien-discret">
        ← commandes
      </Link>
      <h1 className="mt-3 font-titre text-[32px] font-light text-encre">
        Nouvelle commande
      </h1>
      <p className="mt-2 text-[15px] text-lecture">
        La grille tarifaire du client s'applique automatiquement. Les coûts
        seront figés à la confirmation.
      </p>
      <div className="mt-12">
        <CommandeEditeur
          donnees={donnees}
          periodes={periodes}
        />
      </div>
    </div>
  );
}
