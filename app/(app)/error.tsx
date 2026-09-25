"use client";

export default function ErreurApplication({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-[560px] px-6 py-20">
    <h1 className="font-titre text-[32px]">Chargement interrompu</h1>
    <p className="mt-4 text-lecture">La connexion au service a été interrompue. Réessayez pour recharger vos données.</p>
    <button className="bouton-plein mt-6" onClick={reset}>Réessayer</button>
    <a className="lien-discret ml-6" href="/connexion">Connexion</a>
    {error.digest && <p className="etiquette mt-6">Référence : {error.digest}</p>}
  </main>;
}
