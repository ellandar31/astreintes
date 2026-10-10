import { createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalOperation, RegularIntervention, RegularOnCallPeriod } from "../../types";
import { ExceptionalRepository } from "./exceptional.repository";
import { RegularRepository } from "./regular.repository";
import { VisaWorkflowPersistence } from "./visa-workflow.persistence";

const signed = { ...createEmptyVisa(), signed: true, signedAt: "2026-10-10T10:00:00Z" };
const period: RegularOnCallPeriod = { id: "11", teamId: "2", userId: "7", userName: "Agent", userEmail: "agent@example.fr", startDate: "", endDate: "", agentVisa: signed, directorVisa: signed };
const intervention: RegularIntervention = { ...period, id: "12", periodId: period.id, comment: "" };
const operation: ExceptionalOperation = {
  id: "astreinte:11", type: "astreinte", initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent", title: "Operation",
  startDate: "", forecastEndDate: "", actualStartDate: "", actualEndDate: "",
  plannedUsers: [{ userId: "7", displayName: "Agent", email: period.userEmail, startDate: "", endDate: "", visa: signed }], actualUsers: [], interventions: [],
  visas: { initiatorGlobal: signed, directorGlobal: signed, actualInitiator: signed, plannedInitiator: signed, plannedDirector: signed, actualDirector: signed },
};

describe("Persisted approval prerequisites", () => {
  function setup(currentPeriod = period, currentOperation = operation) {
    const regular = {
      fetchRegularPeriods: jest.fn().mockResolvedValue([currentPeriod]),
      fetchRegularInterventions: jest.fn().mockResolvedValue([intervention]),
      saveRegularPeriod: jest.fn().mockResolvedValue(period.id),
      saveRegularIntervention: jest.fn().mockResolvedValue(intervention.id),
    };
    const exceptional = { fetchExceptionalOperation: jest.fn().mockResolvedValue(currentOperation), saveExceptionalOperation: jest.fn().mockResolvedValue(currentOperation.id) };
    const workflow = new VisaWorkflowPersistence(regular as unknown as RegularRepository, exceptional as unknown as ExceptionalRepository);
    return { regular, exceptional, workflow };
  }

  it("revokes the regular director when the period agent visa is removed", async () => {
    const { regular, workflow } = setup();
    await workflow.savePeriod(period.id, { agentVisa: createEmptyVisa() });
    expect(regular.saveRegularPeriod).toHaveBeenCalledWith(period.id, expect.objectContaining({ agentVisa: createEmptyVisa(), directorVisa: createEmptyVisa() }));
  });

  it("revokes the regular director before removing an intervention visa", async () => {
    const { regular, workflow } = setup();
    await workflow.saveIntervention(intervention.id, period.id, { agentVisa: createEmptyVisa() });
    expect(regular.saveRegularPeriod).toHaveBeenCalledWith(period.id, expect.objectContaining({ directorVisa: createEmptyVisa() }));
    expect(regular.saveRegularPeriod.mock.invocationCallOrder[0]).toBeLessThan(regular.saveRegularIntervention.mock.invocationCallOrder[0]);
  });

  it("rejects premature regular director approval and RH send before writing", async () => {
    const { regular, workflow } = setup({ ...period, agentVisa: createEmptyVisa(), directorVisa: createEmptyVisa() });
    await expect(workflow.savePeriod(period.id, { directorVisa: signed })).rejects.toThrow("Tous les autres visas");
    await expect(workflow.savePeriod(period.id, { sentToRhAt: signed.signedAt })).rejects.toThrow("L'envoi aux RH");
    expect(regular.saveRegularPeriod).not.toHaveBeenCalled();
  });

  it("allows regular RH send only when attached interventions are signed too", async () => {
    const { regular, workflow } = setup();
    await workflow.savePeriod(period.id, { sentToRhAt: signed.signedAt });
    regular.fetchRegularInterventions.mockResolvedValue([{ ...intervention, agentVisa: createEmptyVisa() }]);
    await expect(workflow.savePeriod(period.id, { sentToRhAt: signed.signedAt })).rejects.toThrow("L'envoi aux RH");
  });

  it.each(["astreinte", "travaux"] as const)("revokes all %s director aliases after participant visa removal", async type => {
    const current = { ...operation, id: `${type}:11`, type };
    const { exceptional, workflow } = setup(period, current);
    await workflow.saveOperation(current.id, { plannedUsers: [{ ...current.plannedUsers[0], visa: createEmptyVisa() }] });
    expect(exceptional.saveExceptionalOperation).toHaveBeenCalledWith(current.id, expect.objectContaining({ visas: expect.objectContaining({ directorGlobal: createEmptyVisa(), plannedDirector: createEmptyVisa(), actualDirector: createEmptyVisa() }) }));
  });

  it("rejects premature exceptional director approval and RH send", async () => {
    const current = { ...operation, visas: { ...operation.visas, initiatorGlobal: createEmptyVisa(), directorGlobal: createEmptyVisa() } };
    const { exceptional, workflow } = setup(period, current);
    await expect(workflow.saveOperation(current.id, { visas: { ...current.visas, directorGlobal: signed } })).rejects.toThrow("Tous les autres visas");
    await expect(workflow.saveOperation(current.id, { sentToRhAt: signed.signedAt })).rejects.toThrow("L'envoi aux RH");
    expect(exceptional.saveExceptionalOperation).not.toHaveBeenCalled();
  });

  it("allows a complete exceptional RH send", async () => {
    const { exceptional, workflow } = setup();
    await workflow.saveOperation(operation.id, { sentToRhAt: signed.signedAt });
    expect(exceptional.saveExceptionalOperation).toHaveBeenCalledWith(operation.id, expect.objectContaining({ sentToRhAt: signed.signedAt }));
  });

  it("rechecks after a concurrent prerequisite removal before signing the director", async () => {
    const { regular, workflow } = setup();
    let release!: () => void;
    const pendingSave = new Promise<void>(resolve => { release = resolve; });
    regular.saveRegularIntervention.mockImplementation(async () => {
      await pendingSave;
      regular.fetchRegularInterventions.mockResolvedValue([{ ...intervention, agentVisa: createEmptyVisa() }]);
      regular.fetchRegularPeriods.mockResolvedValue([{ ...period, directorVisa: createEmptyVisa() }]);
      return intervention.id;
    });
    const removal = workflow.saveIntervention(intervention.id, period.id, { agentVisa: createEmptyVisa() });
    const approval = workflow.savePeriod(period.id, { directorVisa: signed });
    // Attach the rejection assertion before releasing the first write.
    const rejected = expect(approval).rejects.toThrow("Tous les autres visas");
    release();
    await removal;
    await rejected;
    expect(regular.saveRegularPeriod).toHaveBeenCalledTimes(1);
  });
});
