/**
 * Helper unique d'historisation (§4).
 *
 * Tout modèle portant `dateEffet` est immuable : on n'écrase jamais une ligne,
 * on en insère une nouvelle avec une date d'effet postérieure. La valeur
 * applicable à une date `d` est celle dont la `dateEffet` est la plus récente
 * parmi celles antérieures ou égales à `d`.
 *
 * Aucune requête ne doit chercher « la dernière ligne » sans passer par ici.
 */
export function valeurAuJour<T extends { dateEffet: Date }>(
  rows: readonly T[],
  date: Date,
): T | null {
  const cible = date.getTime();
  let meilleur: T | null = null;
  for (const row of rows) {
    const t = row.dateEffet.getTime();
    if (t <= cible && (meilleur === null || t > meilleur.dateEffet.getTime())) {
      meilleur = row;
    }
  }
  return meilleur;
}

/**
 * Applique `valeurAuJour` par groupe (ex. les composants regroupés par libellé).
 * Retourne, pour chaque clé, la ligne applicable à la date — les clés sans
 * ligne applicable sont omises.
 */
export function valeurAuJourParGroupe<T extends { dateEffet: Date }>(
  rows: readonly T[],
  date: Date,
  cle: (row: T) => string,
): T[] {
  const groupes = new Map<string, T[]>();
  for (const row of rows) {
    const k = cle(row);
    const liste = groupes.get(k);
    if (liste) liste.push(row);
    else groupes.set(k, [row]);
  }
  const resultat: T[] = [];
  for (const liste of groupes.values()) {
    const applicable = valeurAuJour(liste, date);
    if (applicable !== null) resultat.push(applicable);
  }
  return resultat;
}
