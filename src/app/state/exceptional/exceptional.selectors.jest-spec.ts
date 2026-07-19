import { selectExceptionalError, selectExceptionalOperations, selectExceptionalUsers } from "./exceptional.selectors";
import { ExceptionalState } from "./exceptional.reducer";

const state: ExceptionalState = {
  error: "Erreur",
  isSaving: false,
  operations: [],
  users: [{ displayName: "Agent", email: "agent@test.fr", id: "u1" }],
};

describe("exceptional selectors", () => {
  it("expose les opérations exceptionnelles, utilisateurs et erreurs", () => {
    expect(selectExceptionalError.projector(state)).toBe("Erreur");
    expect(selectExceptionalOperations.projector(state)).toBe(state.operations);
    expect(selectExceptionalUsers.projector(state)).toBe(state.users);
  });
});
