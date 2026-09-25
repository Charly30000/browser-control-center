import { describe, expect, it } from "vitest";
import { VariableStore } from "../src/domain/automations/variables";

describe("variables de automatización", () => {
  it("conserva el tipo cuando toda la expresión es una variable", () => {
    const store = new VariableStore({ count: 4, customer: { active: true } });
    expect(store.resolve("{count}")).toEqual({ ok: true, value: 4 });
    expect(store.resolve("{customer}")).toEqual({ ok: true, value: { active: true } });
  });
  it("interpola texto y resuelve objetos recursivamente", () => {
    const store = new VariableStore({ name: "Ana" });
    expect(store.resolve({ greeting: "Hola {name}", list: ["{name}"] })).toEqual({ ok: true, value: { greeting: "Hola Ana", list: ["Ana"] } });
  });
  it("falla ante variables inexistentes o nombres inválidos", () => {
    const store = new VariableStore();
    expect(store.resolve("{missing}").ok).toBe(false);
    expect(store.set("bad-name", "x").ok).toBe(false);
  });
});
