import { describe, expect, it } from "vitest";
import { createEmptyManualProfile, createGeneratorBinding } from "../src/domain/manual/manualProfile";
import { deserializeProfile, serializeProfile } from "../src/infrastructure/persistence/profileSerializer";

describe("referencias de recursos desde Manual", () => {
  it("conserva referencias por ID al serializar el perfil", () => {
    const profile = createEmptyManualProfile("profile-1", "QA");
    profile.generatorBindings.push({
      ...createGeneratorBinding("binding-1"),
      generatorType: "array",
      resourceId: "array-123"
    });
    const parsed = deserializeProfile(serializeProfile(profile));
    expect(parsed.ok && parsed.value.generatorBindings[0]?.resourceId).toBe("array-123");
  });
});
