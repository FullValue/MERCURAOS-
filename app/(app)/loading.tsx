/**
 * État de chargement des pages de l'app : retour visuel immédiat pendant le
 * rendu serveur, dans la grammaire sobre de la DA (pas de spinner).
 */
export default function Chargement() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="h-[40px] w-[240px] max-w-full animate-pulse rounded-[2px] bg-filet" />
      <div className="mt-4 h-[15px] w-[360px] max-w-full animate-pulse rounded-[2px] bg-filet" />
      <div className="mt-12 flex flex-col gap-3 border-t border-filet pt-6">
        <div className="h-[14px] w-full animate-pulse rounded-[2px] bg-filet" />
        <div className="h-[14px] w-[92%] animate-pulse rounded-[2px] bg-filet" />
        <div className="h-[14px] w-[96%] animate-pulse rounded-[2px] bg-filet" />
        <div className="h-[14px] w-[88%] animate-pulse rounded-[2px] bg-filet" />
      </div>
    </div>
  );
}
