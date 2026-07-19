import { createEmptyVisa } from "../../shared/visa.models";
import { ProfileActions } from "./profile.actions";
import { initialProfileState, profileReducer } from "./profile.reducer";

describe("profileReducer", () => {
  it("suit le chargement puis la réception du profil", () => {
    const loading = profileReducer(initialProfileState, ProfileActions.watchStarted({ user: { displayName: null, email: "a@test.fr", uid: "u1" } }));

    expect(loading).toEqual(expect.objectContaining({ isLoading: true, message: "" }));

    const profile = { displayName: "Agent", signatureMode: "name" as const, signatureName: "Agent" };
    const loaded = profileReducer(loading, ProfileActions.profileChanged({ profile }));

    expect(loaded).toEqual(expect.objectContaining({ isLoading: false, profile }));
  });

  it("réinitialise le profil à l'arrêt du watcher", () => {
    const state = profileReducer({ ...initialProfileState, isLoading: true, profile: { signatureMode: "draw" } }, ProfileActions.watchStopped());

    expect(state).toBe(initialProfileState);
  });

  it("trace le succès ou l'échec de sauvegarde", () => {
    const saving = profileReducer(
      initialProfileState,
      ProfileActions.saveRequested({ profile: { signatureMode: "name" }, user: { displayName: "Agent", email: "a@test.fr", uid: "u1" } }),
    );

    expect(saving.isSaving).toBe(true);
    expect(profileReducer(saving, ProfileActions.saveSucceeded({ completedAt: 42, message: "Profil enregistré." }))).toEqual(
      expect.objectContaining({ isSaving: false, message: "Profil enregistré.", saveCompletedAt: 42 }),
    );
    expect(profileReducer(saving, ProfileActions.saveFailed({ message: createEmptyVisa().signedByName || "Erreur" }))).toEqual(
      expect.objectContaining({ isSaving: false, message: "Erreur" }),
    );
  });
});
