import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Aucune table métier existante n'est touchée : schéma temporaire dédié.
if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
const schema = `mercura_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
url.searchParams.set("schema", schema);
url.searchParams.set("connection_limit", "3");
const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), MERCURA_INTEGRATION: "1" };
const db = new PrismaClient({ datasourceUrl: url.toString() });
let status = 1;
try {
  const push = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env, stdio: "inherit" });
  if (push.status !== 0) throw new Error("Initialisation du schéma de test impossible");
  const tests = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "lib/__tests__/integration.test.ts"], { env, stdio: "inherit" });
  status = tests.status ?? 1;
} finally {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  console.log("Schéma temporaire de test supprimé.");
}
process.exitCode = status;
