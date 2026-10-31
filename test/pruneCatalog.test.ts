import { describe, expect, it } from "vitest";
import { pruneCatalog } from "../src/application/persistence/pruneCatalog";

describe("catalog reconciliation", () => {
  it("preserves concurrent additions and renamed entries", async () => {
    const old = { id: "old", name: "Old", updatedAt: "1" };
    const renamed = { ...old, name: "Renamed", updatedAt: "2" };
    const added = { id: "added", name: "Added", updatedAt: "2" };
    expect(await pruneCatalog([old], () => Promise.resolve(false), () => [renamed, added])).toEqual([renamed, added]);
  });
  it("does not turn read errors into missing entries", async () => {
    const rows = [{ id: "keep", name: "Keep", updatedAt: "1" }];
    await expect(pruneCatalog(rows, () => Promise.reject(new Error("denied")), () => rows)).rejects.toThrow("denied");
    expect(rows).toHaveLength(1);
  });
});
