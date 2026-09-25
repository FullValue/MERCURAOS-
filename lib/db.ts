import { PrismaClient } from "@prisma/client";

function creerPrisma() {
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  if (url) {
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "3");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "5");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
  }
  const client = new PrismaClient({
    ...(url ? { datasourceUrl: url.toString() } : {}),
    transactionOptions: { maxWait: 10000, timeout: 30000 },
  });
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          try { return await query(args); }
          catch (error) {
            const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
            // Rejouer une lecture est sûr ; jamais une écriture dont l'issue est inconnue.
            const lecture = ["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"].includes(operation);
            if (lecture && (code === "P1017" || code === "P1001")) return query(args);
            throw error;
          }
        },
      },
    },
  });
}
const globalPrisma = globalThis as unknown as { prismaMercura?: ReturnType<typeof creerPrisma> };
export const prisma = globalPrisma.prismaMercura ?? creerPrisma();
globalPrisma.prismaMercura = prisma;

export type TransactionMercura = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
