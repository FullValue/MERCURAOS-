import { describe, expect, it } from "vitest";
import { decimalPositif, dateValide } from "../validation";
import { litDate, litNombre } from "../import/definitions";

describe("Saisies métier", () => {
  it.each(["Infinity", "NaN", "-1", "0x10", "1e9", "", "1000000"])("refuse le montant %s", (valeur) => {
    expect(decimalPositif.safeParse(valeur).success).toBe(false);
    expect(litNombre(valeur)).toBeNull();
  });
  it("accepte les montants français et zéro", () => {
    expect(litNombre("1 234,50")).toBe("1234.50");
    expect(litNombre("0")).toBe("0");
  });
  it.each(["2026-02-29", "2026-02-31", "2026-13-01", "invalide"])("rejette la date %s", (valeur) => {
    expect(dateValide(valeur)).toBe(false);
    expect(litDate(valeur)).toBeNull();
  });
  it("vérifie aussi les dates françaises et les années bissextiles", () => {
    expect(litDate("31/02/2026")).toBeNull();
    expect(litDate("29/02/2024")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });
});
