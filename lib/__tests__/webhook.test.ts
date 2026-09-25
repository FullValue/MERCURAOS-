import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/shopify/ingestion", () => ({ ingererCommandeShopify: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { ingererCommandeShopify } from "../shopify/ingestion";
import { POST } from "@/app/api/shopify/webhook/route";
const requete = (signatureValide = true) => {
  process.env.SHOPIFY_WEBHOOK_SECRET = "secret-test-uniquement";
  const corps = JSON.stringify({ id: 123 });
  const signature = createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET).update(corps).digest("base64");
  return new NextRequest("http://localhost/api/shopify/webhook", { method: "POST", body: corps, headers: { "x-shopify-topic": "orders/create", "x-shopify-hmac-sha256": signatureValide ? signature : "invalide" } });
};
describe("Livraison du webhook Shopify", () => {
  it("rejette les signatures invalides avant toute ingestion", async () => {
    vi.mocked(ingererCommandeShopify).mockClear();
    expect((await POST(requete(false))).status).toBe(401);
    expect(ingererCommandeShopify).not.toHaveBeenCalled();
  });
  it("autorise Shopify à retenter après une coupure de base", async () => {
    vi.mocked(ingererCommandeShopify).mockRejectedValueOnce(new Error("P1017"));
    expect((await POST(requete())).status).toBe(503);
  });
  it("ne transforme pas un échec métier en succès HTTP", async () => {
    vi.mocked(ingererCommandeShopify).mockResolvedValueOnce({ statut: "erreur", message: "Client absent" });
    expect((await POST(requete())).status).toBe(503);
  });
  it("acquitte une commande ingérée", async () => {
    vi.mocked(ingererCommandeShopify).mockResolvedValueOnce({ statut: "ingeree", reference: "SH-123" });
    expect((await POST(requete())).status).toBe(200);
  });
});
