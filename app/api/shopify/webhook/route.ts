import { revaliderApplication } from "@/lib/actions";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  ingererCommandeShopify,
  type CommandeShopify,
} from "@/lib/shopify/ingestion";

/**
 * Webhook Shopify orders/create et orders/updated (§10).
 * Seul route handler métier de l'application (§2). La signature HMAC est
 * vérifiée avant tout traitement ; le jeton n'est jamais journalisé.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ erreur: "non configuré" }, { status: 503 });
  }

  const corps = await request.text();
  const signature = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const attendu = createHmac("sha256", secret).update(corps, "utf8").digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ erreur: "signature invalide" }, { status: 401 });
  }

  const sujet = request.headers.get("x-shopify-topic") ?? "";
  if (sujet !== "orders/create" && sujet !== "orders/updated") {
    // Sujet non suivi : accusé de réception sans traitement.
    return NextResponse.json({ ok: true });
  }

  try {
    const commande = JSON.parse(corps) as CommandeShopify;
    const resultat = await ingererCommandeShopify(commande);
    if (resultat.statut === "erreur") return NextResponse.json({ ok: false }, { status: 503 });
    revaliderApplication();
    return NextResponse.json({ ok: true, resultat: resultat.statut });
  } catch {
    // Shopify doit retenter une livraison si aucune écriture n’a été validée.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
