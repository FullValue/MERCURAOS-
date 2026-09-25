/**
 * Glossaire centralisé (exigence : chaque terme chiffré porte une définition au
 * survol). Source unique consommée par le composant <Definition>.
 * Langue simple, casse de phrase.
 */
export interface EntreeGlossaire {
  terme: string;
  definition: string;
}

export const GLOSSAIRE = {
  liquide: {
    terme: "coût du liquide",
    definition:
      "Prix du jus contenu dans un flacon : volume × prix du liquide au litre, majoré du taux de perte.",
  },
  conditionnement: {
    terme: "coût du conditionnement",
    definition:
      "Somme des composants du format à la date : flacon, boîte, étiquette, blistage. Le sac, optionnel, n'y est pas compté par défaut.",
  },
  faconnage: {
    terme: "façonnage",
    definition:
      "Coût de la mise en bouteille, modélisé en coût de série : un coût fixe de lot amorti sur la quantité produite, plus un coût variable par flacon.",
  },
  matiereEtCond: {
    terme: "matière et conditionnement",
    definition: "Coût du liquide plus coût du conditionnement.",
  },
  coutComplet: {
    terme: "coût complet",
    definition:
      "Coût de revient d'un flacon : liquide + conditionnement + frais de commande fournisseur répartis (livraison, douane…). C'est la base de toute marge.",
  },
  marge: {
    terme: "marge",
    definition: "Prix de vente moins coût complet, pour un flacon.",
  },
  tauxMarque: {
    terme: "marge en %",
    definition:
      "Part du prix de vente qui reste en marge : marge ÷ prix de vente. 50 % = sur 10 € vendus, 5 € de marge. (Terme comptable : taux de marque.)",
  },
  tauxMarqueBrut: {
    terme: "marge en % (brute)",
    definition:
      "Marge brute ÷ chiffre d'affaires HT : la part du chiffre d'affaires qui reste avant les charges de la commande. C'est elle qui porte le seuil d'alerte de 35 %. (Terme comptable : taux de marque brut.)",
  },
  tauxMarqueNet: {
    terme: "marge en % (nette)",
    definition:
      "Marge nette ÷ chiffre d'affaires HT : la part du chiffre d'affaires qui reste après les charges de la commande (transport, sacs, commissions). (Terme comptable : taux de marque net.)",
  },
  coefficient: {
    terme: "coefficient",
    definition:
      "Rapport prix de vente ÷ coût complet. Un coefficient de 2× veut dire que le prix vaut deux fois le coût.",
  },
  tauxPerte: {
    terme: "taux de perte",
    definition:
      "Part de liquide perdue à la fabrication (évaporation, fonds de cuve, réglages). Majore le coût du liquide.",
  },
  effetVolume: {
    terme: "effet volume",
    definition:
      "Baisse du coût unitaire quand la quantité augmente : le coût fixe de série du façonnage se répartit sur plus de flacons.",
  },
  qteLot: {
    terme: "quantité de lot",
    definition:
      "Nombre de flacons du format produits en une série. Sur une commande, c'est la quantité totale de ce format : elle amortit le coût fixe du façonnage.",
  },
  offert: {
    terme: "offert",
    definition:
      "Ligne dont le coût est compté mais dont le chiffre d'affaires est nul : échantillons, sacs offerts, kits partenaires.",
  },
  coutFige: {
    terme: "coût figé",
    definition:
      "Coût de revient photographié au moment de la confirmation de la commande. Il ne se recalcule plus jamais, même si un prix fournisseur change ensuite.",
  },
  prixCession: {
    terme: "prix de vente",
    definition:
      "Prix HT facturé au client, selon sa grille tarifaire (aussi appelé prix de cession pour un revendeur ou un distributeur).",
  },
  moyenneGamme: {
    terme: "moyenne de gamme",
    definition:
      "Coût complet moyen des références du format. Simple repère d'affichage : jamais utilisé comme base de calcul d'une marge.",
  },
  caHT: {
    terme: "chiffre d'affaires HT",
    definition:
      "Somme des quantités × prix unitaire HT, sur les lignes non offertes.",
  },
  coutRevient: {
    terme: "coût de revient",
    definition:
      "Somme des coûts figés × quantités, sur toutes les lignes, y compris les lignes offertes.",
  },
  chargesRattachees: {
    terme: "charges rattachées",
    definition:
      "Charges affectées directement à la commande : sacs, frais spécifiques, commission de paiement.",
  },
  margeBrute: {
    terme: "marge brute",
    definition: "Chiffre d'affaires HT moins coût de revient.",
  },
  margeNette: {
    terme: "marge nette",
    definition: "Marge brute moins les charges rattachées à la commande.",
  },
  prixLiquide: {
    terme: "prix du liquide",
    definition:
      "Prix d'achat du jus au litre, hors taxes, propre à chaque parfum. Il varie selon les commandes fournisseurs : chaque nouvelle valeur est datée, les anciennes sont conservées.",
  },
  fraisLivraison: {
    terme: "frais de livraison",
    definition:
      "Frais de port d'une commande fournisseur, hors taxes. Facultatifs : s'ils sont renseignés, ils sont répartis sur la quantité de lot, comme le coût fixe de série.",
  },
  periodeCouts: {
    terme: "période de coûts",
    definition:
      "Une commande fournisseur : la photographie datée de tous les coûts (liquides, composants, façonnage, livraison) négociés à ce moment-là. Les calculs utilisent la période en vigueur à la date de chaque commande client.",
  },
  htTtc: {
    terme: "HT / TTC",
    definition:
      "Hors taxes / toutes taxes comprises. Tous les calculs de l'app sont en HT : un montant saisi TTC est ramené en HT en le divisant par 1,20 (TVA 20 %). Une livraison depuis la Chine, sans TVA, se saisit en HT.",
  },
  totalCommande: {
    terme: "total de la commande fournisseur",
    definition:
      "Somme des quantités saisies multipliées par les prix : liquides (litres × prix au litre) + composants (quantité × coût unitaire) + frais de livraison, le tout ramené en HT. C'est un repère d'achat pour la période.",
  },
  coutPaquet: {
    terme: "coût du paquet",
    definition:
      "Coût de revient du paquet selon les formats, éléments optionnels et quantités choisis. Les coûts complets des formats incluent déjà composants, façonnage, livraison et coûts variables répartis. La composition se modifie dans le catalogue.",
  },
  filetDeCharge: {
    terme: "filet de charge",
    definition:
      "Trait sous la référence : la portion noire est la part du coût dans le prix de vente, la portion claire est la marge. Plus le noir est long, plus la marge est mince.",
  },
} as const satisfies Record<string, EntreeGlossaire>;

export type CleGlossaire = keyof typeof GLOSSAIRE;
