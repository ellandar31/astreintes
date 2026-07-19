import { selectProfile, selectProfileIsLoading, selectProfileIsSaving, selectProfileMessage, selectProfileSaveCompletedAt } from "./profile.selectors";
import { ProfileState } from "./profile.reducer";

const state: ProfileState = {
  isLoading: false,
  isSaving: true,
  message: "Profil enregistré.",
  profile: { displayName: "Agent", signatureMode: "name", signatureName: "Agent" },
  saveCompletedAt: 123,
};

describe("profile selectors", () => {
  it("retourne le profil, ses indicateurs et le dernier message", () => {
    expect(selectProfile.projector(state)).toBe(state.profile);
    expect(selectProfileIsLoading.projector(state)).toBe(false);
    expect(selectProfileIsSaving.projector(state)).toBe(true);
    expect(selectProfileMessage.projector(state)).toBe("Profil enregistré.");
    expect(selectProfileSaveCompletedAt.projector(state)).toBe(123);
  });
});
