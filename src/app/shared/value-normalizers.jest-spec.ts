import { asSafeString } from "./value-normalizers";

describe("asSafeString", () => {
  it("conserve les chaines telles quelles", () => {
    expect(asSafeString("Equipe A")).toBe("Equipe A");
  });

  it("convertit uniquement les types primitifs maitrisés", () => {
    expect(asSafeString(3)).toBe("3");
    expect(asSafeString(false)).toBe("false");
  });

  it("utilise le fallback pour les objets afin d'éviter '[object Object]'", () => {
    expect(asSafeString({ name: "Equipe A" }, "fallback")).toBe("fallback");
    expect(asSafeString(["Equipe A"], "")).toBe("");
  });
});
