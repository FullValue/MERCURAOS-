import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Utilisateur authentifié courant, synchronisé avec la table `Utilisateur`.
 * Retourne `null` si aucune session valide.
 */
export const utilisateurCourant = cache(async function utilisateurCourant() {
  const supabase = await creerClientServeur();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  const email = user?.email;

  const comptePin = process.env.PIN_COMPTE_EMAIL?.trim().toLowerCase();
  if (!email || !comptePin || email.toLowerCase() !== comptePin) return null;

  // Synchronise l'Utilisateur applicatif au premier login (isAdmin défaut false).
  // Lecture d'abord : une écriture par page vue coûtait un aller-retour de plus.
  const existant = await prisma.utilisateur.findUnique({ where: { email } });
  if (existant) return existant;
  return prisma.utilisateur.upsert({
    where: { email },
    update: {},
    create: { email },
  });
});

/** Exige une session ; redirige vers /connexion sinon. */
export async function exigerUtilisateur() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  return u;
}
