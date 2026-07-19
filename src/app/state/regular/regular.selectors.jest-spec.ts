import {
  selectRegularError,
  selectRegularInterventions,
  selectRegularPeriods,
  selectRegularPublicHolidays,
  selectRegularTeams,
  selectRegularUsers,
} from "./regular.selectors";
import { RegularState } from "./regular.reducer";

const state: RegularState = {
  error: "Erreur",
  interventions: [{ comment: "", endDate: "", id: "i1", periodId: "p1", startDate: "", teamId: "t1", userEmail: "", userId: "u1", userName: "Agent" }],
  isSaving: false,
  periods: [{ endDate: "", id: "p1", startDate: "", teamId: "t1", userEmail: "", userId: "u1", userName: "Agent" }],
  publicHolidays: [{ date: "2026-07-14", id: "h1", label: "Fête nationale" }],
  teams: [{ id: "t1", members: ["u1"], name: "Equipe" }],
  users: [{ displayName: "Agent", email: "agent@test.fr", id: "u1" }],
};

describe("regular selectors", () => {
  it("retourne les listes nécessaires au calendrier régulier", () => {
    expect(selectRegularError.projector(state)).toBe("Erreur");
    expect(selectRegularInterventions.projector(state)).toBe(state.interventions);
    expect(selectRegularPeriods.projector(state)).toBe(state.periods);
    expect(selectRegularPublicHolidays.projector(state)).toBe(state.publicHolidays);
    expect(selectRegularTeams.projector(state)).toBe(state.teams);
    expect(selectRegularUsers.projector(state)).toBe(state.users);
  });
});
