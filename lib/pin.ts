import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";

function cleIp(ip: string, secret: string) {
  return `ip:${createHmac("sha256", secret).update(`mercura-pin:${ip}`).digest("hex")}`;
}

async function ajouterTentative(cle: string) {
  const lignes = await prisma.$queryRaw<Array<{ essais: number }>>`
    INSERT INTO "TentativePin" ("cle", "essais", "fenetreJusqua")
    VALUES (${cle}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("cle") DO UPDATE SET
      "essais" = CASE
        WHEN "TentativePin"."fenetreJusqua" <= NOW() THEN 1
        ELSE "TentativePin"."essais" + 1
      END,
      "fenetreJusqua" = CASE
        WHEN "TentativePin"."fenetreJusqua" <= NOW() THEN NOW() + INTERVAL '15 minutes'
        ELSE "TentativePin"."fenetreJusqua"
      END
    RETURNING "essais"
  `;
  return lignes[0]?.essais ?? Number.MAX_SAFE_INTEGER;
}

/** Limite les essais par origine et sur l'ensemble du site, même en serverless. */
export async function reserverTentativePin(ip: string, secret: string) {
  if ((await ajouterTentative(cleIp(ip, secret))) > 5) return false;
  return (await ajouterTentative("global")) <= 30;
}

/** Un déverrouillage réussi efface les erreurs de cette origine. */
export async function effacerTentativesPin(ip: string, secret: string) {
  await prisma.tentativePin.deleteMany({ where: { cle: cleIp(ip, secret) } });
}
