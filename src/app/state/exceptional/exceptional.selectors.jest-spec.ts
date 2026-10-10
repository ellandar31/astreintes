import { createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalOperation } from "../../types/exceptional.models";
import { selectExceptionalError, selectExceptionalOperations, selectExceptionalUsers, selectVisibleExceptionalOperations } from "./exceptional.selectors";
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

 describe("visibilité des opérations exceptionnelles", () => {
  const user = { id: "u1", uid: "auth-u1", email: "agent@test.fr", displayName: "Agent", role: 1 as const };
  const participant = { userId: "u1", displayName: "Agent", email: user.email,
    startDate: "", endDate: "", visa: createEmptyVisa() };

  function operation(type: ExceptionalOperation["type"], id: string): ExceptionalOperation {
    return { id, type, title: id, initiatorUid: user.uid, initiatorName: "Agent",
      operationManagerUid: user.uid, operationManagerName: "Agent", startDate: "", forecastEndDate: "",
      actualStartDate: "", actualEndDate: "", plannedUsers: [], actualUsers: [], interventions: [],
      visas: { plannedInitiator: createEmptyVisa(), plannedDirector: createEmptyVisa(),
        actualInitiator: createEmptyVisa(), actualDirector: createEmptyVisa() } };
  }

  it.each(["astreinte", "travaux"] as const)("limite les %s aux participations prévisionnelles ou réelles", type => {
    const planned = { ...operation(type, "planned"), plannedUsers: [participant] };
    const actual = { ...operation(type, "actual"), actualUsers: [participant] };
    const unrelated = { ...operation(type, "other"), plannedUsers: [{ ...participant, userId: "u2" }] };
    expect(selectVisibleExceptionalOperations.projector([planned, actual, unrelated, operation(type, "empty")], user))
      .toEqual([planned, actual]);
  });

  it.each([0, 3, 4] as const)("conserve la vue complète du profil %s", role => {
    const operations = [operation("astreinte", "a"), operation("travaux", "t")];
    expect(selectVisibleExceptionalOperations.projector(operations, { ...user, role })).toBe(operations);
  });

  it.each(["astreinte", "travaux"] as const)("limite le profil initiateur aux %s initiés ou participés", type => {
    const owned = { ...operation(type, "owned"), initiatorUid: user.id };
    const planned = { ...operation(type, "planned"), plannedUsers: [participant] };
    const actual = { ...operation(type, "actual"), actualUsers: [participant] };
    expect(selectVisibleExceptionalOperations.projector([owned, planned, actual, operation(type, "other")], { ...user, role: 2 }))
      .toEqual([owned, planned, actual]);
  });

  it("ne montre aucune opération sans profil chargé", () => {
    expect(selectVisibleExceptionalOperations.projector([operation("astreinte", "a")], undefined)).toEqual([]);
  });
});
