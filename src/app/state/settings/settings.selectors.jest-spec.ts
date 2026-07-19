import {
  selectSettingsHolidays,
  selectSettingsImportedHolidays,
  selectSettingsIsLoadingOfficialHolidays,
  selectSettingsIsSaving,
  selectSettingsMessage,
  selectSettingsRhCompensation,
  selectSettingsRhTemplates,
  selectSettingsTeams,
  selectSettingsUsers,
} from "./settings.selectors";
import { SettingsState } from "./settings.reducer";

const state: SettingsState = {
  holidays: [{ date: "2026-07-14", id: "h1", label: "Fête nationale", source: "manual", zone: "metropole" }],
  importedHolidays: [],
  isLoadingOfficialHolidays: true,
  isSaving: true,
  message: { completedAt: 1, kind: "success", message: "ok", source: "teams" },
  rhCompensation: { onCall: [], periods: [] },
  rhTemplates: [{ fileName: "template.docx", id: "regular", label: "Régulier" }],
  teams: [{ id: "t1", members: ["u1"], name: "Equipe" }],
  users: [{ displayName: "Agent", email: "agent@test.fr", id: "u1", role: 1 }],
};

describe("settings selectors", () => {
  it("expose les référentiels et états de chargement des paramètres", () => {
    expect(selectSettingsUsers.projector(state)).toBe(state.users);
    expect(selectSettingsTeams.projector(state)).toBe(state.teams);
    expect(selectSettingsHolidays.projector(state)).toBe(state.holidays);
    expect(selectSettingsImportedHolidays.projector(state)).toBe(state.importedHolidays);
    expect(selectSettingsIsLoadingOfficialHolidays.projector(state)).toBe(true);
    expect(selectSettingsIsSaving.projector(state)).toBe(true);
    expect(selectSettingsMessage.projector(state)).toBe(state.message);
    expect(selectSettingsRhCompensation.projector(state)).toBe(state.rhCompensation);
    expect(selectSettingsRhTemplates.projector(state)).toBe(state.rhTemplates);
  });
});
