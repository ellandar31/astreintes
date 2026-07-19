import { createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalActions } from "./exceptional.actions";
import { exceptionalReducer, initialExceptionalState } from "./exceptional.reducer";

describe("exceptionalReducer", () => {
  it("remplace les opérations et utilisateurs depuis les watchers", () => {
    const state = exceptionalReducer(
      initialExceptionalState,
      ExceptionalActions.operationsChanged({
        operations: [
          {
            actualEndDate: "",
            actualStartDate: "",
            actualUsers: [],
            forecastEndDate: "",
            id: "op1",
            initiatorName: "Initiateur",
            initiatorUid: "u1",
            interventions: [],
            operationManagerName: "Responsable",
            operationManagerUid: "u2",
            plannedUsers: [],
            startDate: "2026-07-06T18:00:00",
            title: "Opération",
            type: "astreinte",
            visas: {
              actualDirector: createEmptyVisa(),
              actualInitiator: createEmptyVisa(),
              plannedDirector: createEmptyVisa(),
              plannedInitiator: createEmptyVisa(),
            },
          },
        ],
      }),
    );

    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].title).toBe("Opération");
  });

  it("protège les actions de modification par un état de sauvegarde", () => {
    const state = exceptionalReducer(
      { ...initialExceptionalState, error: "ancienne erreur" },
      ExceptionalActions.operationPatchRequested({ operationId: "op1", payload: { sentToRhAt: "2026-07-19T10:00:00" } }),
    );

    expect(state).toEqual(expect.objectContaining({ error: "", isSaving: true }));
  });

  it("expose les erreurs de chargement et d'opération", () => {
    expect(exceptionalReducer(initialExceptionalState, ExceptionalActions.loadFailed({ message: "Lecture impossible" }))).toEqual(
      expect.objectContaining({ error: "Lecture impossible", isSaving: false }),
    );
  });
});
