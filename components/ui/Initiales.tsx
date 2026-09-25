/** Pastille circulaire d'initiales (§8.4), 36 px, fond --fond. */
export function Initiales({ nom }: { nom: string }) {
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="initiales" aria-hidden="true">
      {initiales}
    </span>
  );
}
