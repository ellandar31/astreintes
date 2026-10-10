import { createEmptyVisa } from "./visa.models";
import { clearExceptionalDirectorVisas, exceptionalReadyForDirector, exceptionalReadyForRh, regularReadyForDirector, regularReadyForRh } from "./visa-workflow";

const signed = { ...createEmptyVisa(), signed: true, signedAt: "2026-10-10T10:00:00Z" };
const unsigned = createEmptyVisa();

describe("Approval chain", () => {
  it("requires the regular agent and every intervention before the director", () => {
    expect(regularReadyForDirector({ agentVisa: signed }, [])).toBe(true);
    expect(regularReadyForDirector({ agentVisa: unsigned }, [])).toBe(false);
    expect(regularReadyForDirector({ agentVisa: signed }, [{ agentVisa: signed }, {}])).toBe(false);
    expect(regularReadyForDirector({ agentVisa: signed }, [{ agentVisa: signed }])).toBe(true);
  });

  it("also requires the regular director for RH", () => {
    expect(regularReadyForRh({ agentVisa: signed }, [])).toBe(false);
    expect(regularReadyForRh({ agentVisa: signed, directorVisa: signed }, [])).toBe(true);
    expect(regularReadyForRh({ agentVisa: signed, directorVisa: signed }, [{ agentVisa: unsigned }])).toBe(false);
  });

  const complete = {
    visas: { initiatorGlobal: signed, directorGlobal: signed },
    plannedUsers: [{ visa: signed }], actualUsers: [{ visa: signed }], interventions: [{ agentVisa: signed }],
  };
  // Only signature-bearing fields are needed by these pure rules.
  function operation() {
    return {
      visas: complete.visas,
      plannedUsers: [{ userId: "7", displayName: "Agent", email: "agent@example.fr", visa: signed }],
      actualUsers: [{ userId: "7", displayName: "Agent", email: "agent@example.fr", visa: signed }],
      interventions: [{ userId: "7", userName: "Agent", userEmail: "agent@example.fr", startDate: "", endDate: "", agentVisa: signed }],
    };
  }

  it.each(["initiator", "planned", "actual", "intervention"])("blocks exceptional director and RH when the %s visa is missing", missing => {
    const value = operation();
    if (missing === "initiator") value.visas = { ...value.visas, initiatorGlobal: unsigned };
    if (missing === "planned") value.plannedUsers[0].visa = unsigned;
    if (missing === "actual") value.actualUsers[0].visa = unsigned;
    if (missing === "intervention") value.interventions[0].agentVisa = unsigned;
    expect(exceptionalReadyForDirector(value)).toBe(false);
    expect(exceptionalReadyForRh(value)).toBe(false);
  });

  it("allows work operations without interventions and distinguishes director approval", () => {
    const value = { ...operation(), interventions: [] };
    expect(exceptionalReadyForRh(value)).toBe(true);
    value.visas = { ...value.visas, directorGlobal: unsigned };
    expect(exceptionalReadyForDirector(value)).toBe(true);
    expect(exceptionalReadyForRh(value)).toBe(false);
  });

  it("does not resurrect legacy director signatures after revocation", () => {
    const visas = clearExceptionalDirectorVisas({ initiatorGlobal: signed, directorGlobal: signed, actualDirector: signed, plannedDirector: signed });
    expect(visas.initiatorGlobal).toBe(signed);
    expect([visas.directorGlobal, visas.actualDirector, visas.plannedDirector].every(visa => !visa.signed)).toBe(true);
    expect(exceptionalReadyForRh({ ...operation(), visas })).toBe(false);
  });
});
