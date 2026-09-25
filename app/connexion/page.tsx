"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";

const etatInitial: EtatConnexion = { statut: "inactif" };

export default function PageConnexion() {
  const [etat, action, enCours] = useActionState(seConnecter, etatInitial);

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(300px,38%)_1fr]">
      <div className="navigation-rouge flex min-h-[190px] flex-col justify-between px-8 py-8 lg:px-12 lg:py-12">
        <span className="font-mono text-[11px] tracking-[0.16em]">MERCURA / OS</span>
        <h1 className="font-titre text-[40px] font-light leading-none lg:text-[68px]">
          Mercura<br />Parfum
        </h1>
        <span className="hidden font-mono text-[11px] tracking-[0.08em] lg:block">COÛTS · COMMANDES · RENTABILITÉ</span>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[390px]">
      <h2 className="font-titre text-[32px] font-light text-encre">Connexion</h2>
      <p className="mt-2 text-[15px] text-lecture">Accédez à votre espace de gestion.</p>
      <form action={action} className="mt-10 flex flex-col gap-4">
        <label htmlFor="email" className="font-mono text-[11px] tracking-[0.04em] text-lecture">
          adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="champ"
          placeholder="vous@exemple.fr"
        />
        <label
          htmlFor="motDePasse"
          className="mt-2 font-mono text-[11px] tracking-[0.04em] text-lecture"
        >
          mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          required
          autoComplete="current-password"
          className="champ"
        />
        <button type="submit" disabled={enCours} className="bouton-plein mt-2">
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      {etat.statut === "erreur" && etat.message && (
        <p role="alert" className="mt-6 text-[13px] text-alerte">{etat.message}</p>
      )}
      </div>
      </div>
    </main>
  );
}
