import { selectAuthError, selectAuthUser, selectDisplayName, selectIsSubmitting, selectLoadingSession } from "./auth.selectors";
import { AuthState } from "./auth.reducer";

const state: AuthState = {
  error: "Erreur",
  isSubmitting: true,
  loadingSession: false,
  user: { displayName: "", email: "agent@test.fr", uid: "u1" },
};

describe("auth selectors", () => {
  it("expose les champs d'authentification utilisés par l'interface", () => {
    expect(selectAuthUser.projector(state)).toBe(state.user);
    expect(selectAuthError.projector(state)).toBe("Erreur");
    expect(selectIsSubmitting.projector(state)).toBe(true);
    expect(selectLoadingSession.projector(state)).toBe(false);
  });

  it("calcule le nom affiché avec fallback email puis libellé générique", () => {
    expect(selectDisplayName.projector({ displayName: "", email: "agent@test.fr", uid: "u1" })).toBe("agent@test.fr");
    expect(selectDisplayName.projector(null)).toBe("Utilisateur");
  });
});
