import { StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "./auth.actions";
import { authReducer, initialAuthState } from "./auth.reducer";

const user: StoreAuthUser = {
  displayName: "Agent Test",
  email: "agent@test.fr",
  uid: "user-1",
};

describe("authReducer", () => {
  it("passe en soumission pendant une connexion email", () => {
    const state = authReducer(initialAuthState, AuthActions.emailLoginRequested({ createAccount: false, email: "a@b.fr", password: "secret" }));

    expect(state).toEqual(expect.objectContaining({ error: "", isSubmitting: true }));
  });

  it("charge la session authentifiée et arrête les indicateurs de chargement", () => {
    const state = authReducer({ ...initialAuthState, isSubmitting: true }, AuthActions.sessionChanged({ user }));

    expect(state).toEqual(expect.objectContaining({ error: "", isSubmitting: false, loadingSession: false, user }));
  });

  it("vide l'utilisateur courant à la demande de déconnexion", () => {
    const state = authReducer({ ...initialAuthState, loadingSession: false, user }, AuthActions.logoutRequested());

    expect(state).toEqual(expect.objectContaining({ error: "", isSubmitting: false, loadingSession: false, user: null }));
  });

  it("conserve le message d'erreur lorsqu'une connexion échoue", () => {
    const state = authReducer({ ...initialAuthState, isSubmitting: true }, AuthActions.loginFailed({ error: "Connexion impossible" }));

    expect(state).toEqual(expect.objectContaining({ error: "Connexion impossible", isSubmitting: false }));
  });
});
