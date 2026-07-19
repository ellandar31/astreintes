import { createEmptyVisa } from "./visa.models";

describe("createEmptyVisa", () => {
  it("crée un visa non signé sans information utilisateur", () => {
    expect(createEmptyVisa()).toEqual({
      signed: false,
      signedAt: "",
      signedByName: "",
      signedByUid: "",
    });
  });
});
