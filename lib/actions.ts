import { revalidatePath } from "next/cache";

/** Toutes les vues métier partagent les commandes, tarifs et coûts. */
export function revaliderApplication() {
  revalidatePath("/", "layout");
}

export class ErreurMetier extends Error {}

export function erreurAction(erreur: unknown): { ok: false; message: string } {
  if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
  const code = erreur && typeof erreur === "object" && "code" in erreur ? erreur.code : undefined;
  console.error("Échec action métier", { code: code ?? "inconnu" });
  if (code === "P2002") return { ok: false, message: "Cette référence existe déjà. Actualisez puis réessayez." };
  if (code === "P2025") return { ok: false, message: "Cet élément a été modifié ou supprimé. Actualisez la page." };
  if (code === "P2003") return { ok: false, message: "Un élément lié est introuvable ou encore utilisé." };
  return { ok: false, message: "Enregistrement impossible. Vérifiez la connexion puis réessayez." };
}
