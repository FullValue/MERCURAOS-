import { z } from "zod";

/** Accepte la saisie française ; refuse les valeurs non finies et hors base. */
export const decimalPositif = z.string()
  .transform((s) => s.replace(/\s/g, "").replace(",", "."))
  .refine((s) => /^\d+(\.\d*)?$/.test(s) && Number.isFinite(Number(s)) && Number(s) < 1000000,
    "Saisir un montant positif valide inférieur à 1 000 000.");

export function dateValide(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export const dateSaisie = z.string().refine(dateValide, "Date invalide");
