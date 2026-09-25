import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement du jeton Shopify (§10) : AES-256-GCM, clé en variable
 * d'environnement (CHIFFREMENT_CLE, 32 octets base64). Format stocké :
 * base64(iv):base64(tag):base64(ciphertext). Le jeton n'est jamais journalisé
 * ni réaffiché en clair.
 */

function cle(): Buffer {
  const brute = process.env.CHIFFREMENT_CLE;
  if (!brute) throw new Error("CHIFFREMENT_CLE manquante");
  const k = Buffer.from(brute, "base64");
  if (k.length !== 32) throw new Error("CHIFFREMENT_CLE doit faire 32 octets (base64)");
  return k;
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cle(), iv);
  const chiffre = Buffer.concat([cipher.update(clair, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${chiffre.toString("base64")}`;
}

export function dechiffrer(stocke: string): string {
  const [ivB64, tagB64, dataB64] = stocke.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Format de jeton chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", cle(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
