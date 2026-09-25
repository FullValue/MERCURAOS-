/** Seuil d'alerte du taux de marque brut (§8.6) : sous 35 %, le chiffre passe en --alerte. */
export const SEUIL_ALERTE_MARGE = 0.35;

/** Écart à la moyenne de gamme signalé dans la synthèse (§8.7) : plus de 5 points. */
export const SEUIL_ECART_GAMME = 0.05;

/** Règle de commission Shopify par défaut (§10). */
export const COMMISSION_SHOPIFY_DEFAUT = { tauxPct: 1.4, fixe: 0.25 } as const;
