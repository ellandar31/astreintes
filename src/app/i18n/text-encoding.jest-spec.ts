import { normalizeObjectTextEncoding, normalizeTextEncoding } from "./text-encoding";

describe("text encoding normalization", () => {
  it("normalise les chaines mojibake connues en Unicode NFC", () => {
    expect(normalizeTextEncoding("Jour fÃ©riÃ©")).toBe("Jour férié");
    expect(normalizeTextEncoding("RÃ´le utilisateur")).toBe("Rôle utilisateur");
  });

  it("normalise récursivement les tableaux et objets imbriqués", () => {
    const value = normalizeObjectTextEncoding({
      label: "Astreinte rÃ©guliÃ¨re",
      rows: [{ title: "EnvoyÃ© aux RH" }],
    });

    expect(value).toEqual({
      label: "Astreinte régulière",
      rows: [{ title: "Envoyé aux RH" }],
    });
  });
});
