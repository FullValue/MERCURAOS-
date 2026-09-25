"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENTREES = [
  { href: "/parametres", libelle: "Registre des coûts" },
  { href: "/catalogue", libelle: "Catalogue" },
  { href: "/simulateur", libelle: "Simulateur" },
  { href: "/grille-tarifaire", libelle: "Grille tarifaire" },
  { href: "/clients", libelle: "Clients" },
  { href: "/commandes", libelle: "Commandes" },
  { href: "/synthese", libelle: "Synthèse" },
  { href: "/import", libelle: "Import" },
  { href: "/reglages", libelle: "Réglages" },
];

function Liens({ chemin }: { chemin: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {ENTREES.map((e) => {
        const actif = chemin === e.href || chemin.startsWith(`${e.href}/`);
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={actif ? "page" : undefined}
              className="lien-navigation block rounded-r-sm py-2 pl-3 pr-2 text-[15px] transition-colors"
            >
              {e.libelle}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Deconnexion() {
  return (
    <div className="border-t border-white/40 pt-4">
      <p className="etiquette">Espace privé</p>
      <form action="/deconnexion" method="post">
        <button type="submit" className="lien-discret mt-2 inline-block">
          verrouiller l’espace
        </button>
      </form>
    </div>
  );
}

export function BarreLaterale() {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  // Referme le menu mobile à chaque navigation.
  useEffect(() => {
    setOuvert(false);
  }, [chemin]);

  return (
    <>
      {/* Barre latérale — écrans larges */}
      <nav
          className="navigation-rouge fixed left-0 top-0 z-40 hidden h-full w-[220px] flex-col justify-between px-6 py-8 lg:flex"
        aria-label="Navigation principale"
      >
        <div>
          <Link href="/" className="font-titre text-[25px] font-light leading-tight">
            Mercura<br />Parfum
          </Link>
          <div className="mt-12">
            <Liens chemin={chemin} />
          </div>
        </div>
        <Deconnexion />
      </nav>

      {/* Barre haute — mobile */}
      <header className="navigation-rouge sticky top-0 z-40 flex items-center justify-between px-5 py-3 lg:hidden">
        <Link href="/" className="font-titre text-[22px] font-light">
          Mercura Parfum
        </Link>
        <button
          type="button"
          className="rounded-sm px-2 py-1 text-[14px] underline underline-offset-4"
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
          onClick={() => setOuvert((v) => !v)}
        >
          {ouvert ? "fermer" : "menu"}
        </button>
      </header>

      {/* Menu mobile déroulant */}
      {ouvert && (
        <nav
          id="menu-mobile"
          aria-label="Navigation principale"
          className="navigation-rouge fixed inset-x-0 top-[53px] bottom-0 z-40 flex flex-col justify-between overflow-y-auto px-5 py-6 lg:hidden"
        >
          <Liens chemin={chemin} />
          <Deconnexion />
        </nav>
      )}
    </>
  );
}
