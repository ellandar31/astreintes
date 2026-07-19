import { createEmptyVisa } from "../../shared/visa.models";
import { RegularActions } from "./regular.actions";
import { initialRegularState, regularReducer } from "./regular.reducer";

describe("regularReducer", () => {
  it("met à jour les référentiels et périodes du calendrier régulier", () => {
    const withUsers = regularReducer(initialRegularState, RegularActions.usersChanged({ users: [{ displayName: "Agent", email: "a@test.fr", id: "u1" }] }));
    const withPeriods = regularReducer(
      withUsers,
      RegularActions.periodsChanged({
        periods: [
          {
            endDate: "2026-07-07T08:00:00",
            id: "p1",
            startDate: "2026-07-06T18:00:00",
            teamId: "team-1",
            userEmail: "a@test.fr",
            userId: "u1",
            userName: "Agent",
          },
        ],
      }),
    );

    expect(withPeriods.users).toHaveLength(1);
    expect(withPeriods.periods).toHaveLength(1);
  });

  it("active la sauvegarde pendant une demande de visa global", () => {
    const state = regularReducer(
      { ...initialRegularState, error: "ancienne erreur" },
      RegularActions.periodVisaUpdateRequested({ field: "agentVisa", periodId: "p1", visa: createEmptyVisa() }),
    );

    expect(state).toEqual(expect.objectContaining({ error: "", isSaving: true }));
  });

  it("arrête la sauvegarde en succès ou en erreur", () => {
    expect(regularReducer({ ...initialRegularState, isSaving: true }, RegularActions.operationSucceeded()).isSaving).toBe(false);
    expect(regularReducer({ ...initialRegularState, isSaving: true }, RegularActions.operationFailed({ message: "Erreur" }))).toEqual(
      expect.objectContaining({ error: "Erreur", isSaving: false }),
    );
  });
});
