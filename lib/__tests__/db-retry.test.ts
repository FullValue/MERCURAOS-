import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ operation: null as null | ((args: { operation: string; args: object; query: (args: object) => Promise<unknown> }) => Promise<unknown>) }));
vi.mock("@prisma/client", () => ({ PrismaClient: class {
  $extends(extension: { query: { $allModels: { $allOperations: NonNullable<typeof mocks.operation> } } }) {
    mocks.operation = extension.query.$allModels.$allOperations;
    return this;
  }
} }));
import "../db";
describe("Reconnexion Prisma", () => {
  it("rejoue une seule fois une lecture après P1017", async () => {
    const query = vi.fn().mockRejectedValueOnce({ code: "P1017" }).mockResolvedValueOnce([{ id: "client" }]);
    expect(await mocks.operation!({ operation: "findMany", args: {}, query })).toEqual([{ id: "client" }]);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("ne rejoue jamais une écriture à l'issue inconnue", async () => {
    const query = vi.fn().mockRejectedValue({ code: "P1017" });
    await expect(mocks.operation!({ operation: "create", args: {}, query })).rejects.toEqual({ code: "P1017" });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("ne boucle pas lorsque la base reste indisponible", async () => {
    const query = vi.fn().mockRejectedValue({ code: "P1017" });
    await expect(mocks.operation!({ operation: "findMany", args: {}, query })).rejects.toEqual({ code: "P1017" });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
