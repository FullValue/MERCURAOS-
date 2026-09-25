"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { creerClientServeur } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Adresse e-mail invalide."),
  motDePasse: z.string().min(1, "Mot de passe requis."),
});

export interface EtatConnexion {
  statut: "inactif" | "erreur";
  message?: string;
}

/** Connexion par identifiants (email + mot de passe). */
export async function seConnecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const parsed = schema.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });
  if (!parsed.success) {
    return { statut: "erreur", message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await creerClientServeur();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.motDePasse,
    });
    if (error) {
      return { statut: "erreur", message: error.status === 400 ? "Identifiants incorrects." : "Connexion temporairement indisponible. Réessayez dans un instant." };
    }
  } catch {
    return { statut: "erreur", message: "Le service de connexion ne répond pas. Réessayez." };
  }
  redirect("/");
}
