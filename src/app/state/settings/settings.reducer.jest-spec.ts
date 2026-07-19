import { SettingsActions } from "./settings.actions";
import { initialSettingsState, settingsReducer } from "./settings.reducer";

describe("settingsReducer", () => {
  it("gère le cycle d'import des jours fériés officiels", () => {
    const loading = settingsReducer(initialSettingsState, SettingsActions.officialHolidaysLoadRequested({ year: 2026, zone: "metropole" }));

    expect(loading).toEqual(expect.objectContaining({ importedHolidays: [], isLoadingOfficialHolidays: true, message: null }));

    const loaded = settingsReducer(
      loading,
      SettingsActions.officialHolidaysLoaded({
        holidays: [{ date: "2026-07-14", id: "metropole_2026-07-14", label: "Fête nationale", source: "api.gouv.fr", zone: "metropole" }],
      }),
    );

    expect(loaded.importedHolidays).toHaveLength(1);
    expect(loaded.isLoadingOfficialHolidays).toBe(false);
  });

  it("pose un message typé après une opération réussie", () => {
    const state = settingsReducer(
      { ...initialSettingsState, isSaving: true },
      SettingsActions.operationSucceeded({ completedAt: 123, message: "Équipe enregistrée.", source: "teams" }),
    );

    expect(state).toEqual(
      expect.objectContaining({
        isSaving: false,
        message: { completedAt: 123, kind: "success", message: "Équipe enregistrée.", source: "teams" },
      }),
    );
  });

  it("active la sauvegarde pour les mutations de paramétrage", () => {
    const state = settingsReducer(
      { ...initialSettingsState, message: { completedAt: 1, kind: "success", message: "ok", source: "users" } },
      SettingsActions.teamDeleteRequested({ teamId: "team-1" }),
    );

    expect(state).toEqual(expect.objectContaining({ isSaving: true, message: null }));
  });
});
