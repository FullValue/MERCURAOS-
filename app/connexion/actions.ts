"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { creerClientServeur } from "@/lib/supabase/server";
import { effacerTentativesPin, reserverTentativePin } from "@/lib/pin";

const schema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "Saisissez un code PIN de 4 à 8 chiffres."),
});

export interface EtatConnexion {
  statut: "inactif" | "erreur";
  message?: string;
}

/** Le compte Auth dédié reste côté serveur ; le navigateur ne reçoit que le PIN. */
export async function seConnecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const parsed = schema.safeParse({ pin: donnees.get("pin") });
  if (!parsed.success) {
    return { statut: "erreur", message: parsed.error.issues[0]?.message };
  }

  const email = process.env.PIN_COMPTE_EMAIL?.trim().toLowerCase();
  const suffixe = process.env.PIN_SUFFIXE_SECRET;
  if (!email || !suffixe || suffixe.length < 32) {
    return { statut: "erreur", message: "L’accès par code PIN n’est pas configuré." };
  }

  try {
    const entetes = await headers();
    const ip = entetes.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? entetes.get("x-real-ip")
      ?? "adresse-inconnue";
    if (!(await reserverTentativePin(ip, suffixe))) {
      return { statut: "erreur", message: "Trop d’essais. Réessayez dans 15 minutes." };
    }

    const supabase = await creerClientServeur();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: `${parsed.data.pin}${suffixe}`,
    });
    if (error || data.user?.email?.toLowerCase() !== email) {
      return {
        statut: "erreur",
        message: error?.status === 400 ? "Code PIN incorrect." : "Accès temporairement indisponible. Réessayez.",
      };
    }
    try {
      await effacerTentativesPin(ip, suffixe);
    } catch (erreur) {
      console.error("Nettoyage de la limite PIN impossible", erreur);
    }
  } catch {
    return { statut: "erreur", message: "Le service d’accès ne répond pas. Réessayez." };
  }
  redirect("/");
}
