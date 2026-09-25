"use client";

import Image from "next/image";
import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";

const etatInitial: EtatConnexion = { statut: "inactif" };

export default function PageConnexion() {
  const [etat, action, enCours] = useActionState(seConnecter, etatInitial);

  return (
    <main className="ecran-pin">
      <div className="ecran-pin__contenu">
        <div className="ecran-pin__logo" aria-label="Mercura Parfum">
          <Image
            src="/mercura-monogramme.png"
            alt=""
            width={338}
            height={312}
            priority
            className="ecran-pin__logo-halo"
            aria-hidden="true"
          />
          <Image
            src="/mercura-monogramme.png"
            alt=""
            width={338}
            height={312}
            priority
            className="ecran-pin__logo-trait"
            aria-hidden="true"
          />
        </div>

        <div className="ecran-pin__acces">
          <p className="ecran-pin__marque">MERCURA PARFUM</p>
          <h1 className="ecran-pin__titre">Déverrouiller l’espace</h1>
          <form action={action} className="ecran-pin__formulaire">
            <label htmlFor="pin" className="ecran-pin__etiquette">Code PIN</label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              required
              autoComplete="off"
              autoFocus
              placeholder="••••"
              className="ecran-pin__champ"
              aria-invalid={etat.statut === "erreur"}
              aria-describedby={etat.statut === "erreur" ? "erreur-pin" : undefined}
            />
            <button type="submit" disabled={enCours} className="ecran-pin__bouton">
              {enCours ? "Vérification…" : "Déverrouiller"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          {etat.statut === "erreur" && etat.message && (
            <p id="erreur-pin" role="alert" className="ecran-pin__erreur">{etat.message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
