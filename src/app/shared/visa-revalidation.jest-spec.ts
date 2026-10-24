import { ExceptionalOperation, RegularIntervention, RegularOnCallPeriod } from "../types";
import { createEmptyVisa } from "./visa.models";
import { revalidateExceptionalOperation, revalidateRegularIntervention, revalidateRegularPeriod } from "./visa-revalidation";

const visa = { ...createEmptyVisa(), signed: true, signedAt: "2026-10-10T10:00:00Z", signedByName: "Agent" };
const period: RegularOnCallPeriod = { id: "1", teamId: "2", userId: "7", userName: "Agent", userEmail: "agent@example.fr", startDate: "2026-10-10T18:00", endDate: "2026-10-11T08:00", agentVisa: visa, directorVisa: visa };
const intervention: RegularIntervention = { ...period, id: "2", periodId: "1", comment: "Intervention" };
const participant = { userId: "7", displayName: "Agent", email: period.userEmail, startDate: period.startDate, endDate: period.endDate, visa };
const operation: ExceptionalOperation = {
  id: "astreinte:1", type: "astreinte", initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "8", operationManagerName: "Manager", title: "Operation",
  startDate: period.startDate, forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
  plannedUsers: [participant, { ...participant, userId: "8" }], actualUsers: [participant],
  interventions: [{ userId: "7", userName: "Agent", userEmail: period.userEmail, startDate: period.startDate, endDate: period.endDate, wasOnSite: true, label: "", comment: "", agentVisa: visa }],
  visas: { initiatorGlobal: visa, directorGlobal: visa, plannedInitiator: visa, actualInitiator: visa, plannedDirector: visa, actualDirector: visa },
};

function expectGlobalRevocation(value: ReturnType<typeof revalidateExceptionalOperation>) {
  expect(Object.values(value.visas!).every(signature => !signature.signed)).toBe(true);
}

describe("Visa revalidation after business edits", () => {
  it.each([{ startDate: "2026-10-10T19:00" }, { endDate: "2026-10-11T09:00" }, { userId: "9" }, { teamId: "3" }, { directionId: "3" }])("revokes regular period approvals after %j", update => {
    const value = revalidateRegularPeriod(period, update);
    expect(value.agentVisa).toEqual(createEmptyVisa());
    expect(value.directorVisa).toEqual(createEmptyVisa());
    expect(period.agentVisa).toBe(visa);
  });

  it("restarts global exceptional approval when its direction changes", () => {
    const value = revalidateExceptionalOperation({ ...operation, directionId: "1" }, { directionId: "2" });
    expectGlobalRevocation(value);
    expect(value.plannedUsers![0].visa).toBe(visa);
  });

  it("preserves approvals for unchanged data, equivalent date formats and label edits", () => {
    const value = revalidateRegularPeriod(period, { startDate: new Date(period.startDate).toISOString(), userName: "New label" });
    expect(value.agentVisa).toBe(visa);
    expect(value.directorVisa).toBe(visa);
    expect(revalidateExceptionalOperation(operation, { title: "New title" }).visas).toBe(operation.visas);
  });

  it.each([{ startDate: "2026-10-10T19:00" }, { endDate: "2026-10-11T09:00" }, { userId: "9" }])("revokes intervention approval after %j", update => {
    expect(revalidateRegularIntervention(intervention, "1", update).agentVisa).toEqual(createEmptyVisa());
  });

  it("does not transfer a signature to a new or moved intervention", () => {
    expect(revalidateRegularIntervention(undefined, "3", intervention).agentVisa).toEqual(createEmptyVisa());
    expect(revalidateRegularIntervention(intervention, "3", {}).agentVisa).toEqual(createEmptyVisa());
    expect(revalidateRegularIntervention(intervention, "1", { comment: "New comment" }).agentVisa).toBe(visa);
  });

  it.each(["astreinte", "travaux"] as const)("revokes only changed %s participants and global approvals", type => {
    const current = { ...operation, type, interventions: type === "travaux" ? [] : operation.interventions };
    const value = revalidateExceptionalOperation(current, { plannedUsers: [{ ...participant, startDate: "2026-10-10T19:00" }, current.plannedUsers[1]] });
    expect(value.plannedUsers![0].visa).toEqual(createEmptyVisa());
    expect(value.plannedUsers![1].visa).toBe(visa);
    expect(value.actualUsers![0].visa).toBe(visa);
    expectGlobalRevocation(value);
  });

  it("invalidates an added/replaced participant, but not other participants", () => {
    const value = revalidateExceptionalOperation(operation, { plannedUsers: [{ ...participant, userId: "9" }, operation.plannedUsers[1], { ...participant, userId: "10" }] });
    expect(value.plannedUsers!.map(row => row.visa.signed)).toEqual([false, true, false]);
    expectGlobalRevocation(value);
  });

  it("revokes global approvals on removal even when all remaining participant visas are signed", () => {
    const value = revalidateExceptionalOperation(operation, { plannedUsers: [participant] });
    expect(value.plannedUsers![0].visa).toBe(visa);
    expectGlobalRevocation(value);
  });

  it("preserves approvals when rows are only reordered", () => {
    const value = revalidateExceptionalOperation(operation, { plannedUsers: [...operation.plannedUsers].reverse() });
    expect(value.visas).toBe(operation.visas);
    expect(value.plannedUsers!.every(row => row.visa.signed)).toBe(true);
  });

  it("handles duplicate periods without letting an added duplicate inherit a visa", () => {
    const current = { ...operation, plannedUsers: [participant, participant] };
    const value = revalidateExceptionalOperation(current, { plannedUsers: [participant, participant, participant] });
    expect(value.plannedUsers!.map(row => row.visa.signed)).toEqual([true, true, false]);
    expectGlobalRevocation(value);
  });

  it("revokes actual participant and global approvals after an actual time edit", () => {
    const value = revalidateExceptionalOperation(operation, { actualUsers: [{ ...participant, endDate: "2026-10-11T07:00" }] });
    expect(value.actualUsers![0].visa.signed).toBe(false);
    expect(value.plannedUsers![0].visa.signed).toBe(true);
    expectGlobalRevocation(value);
  });

  it("does not clear unrelated participant visas when a row edit changes calculated global bounds", () => {
    const value = revalidateExceptionalOperation(operation, { plannedUsers: [{ ...participant, startDate: "2026-10-10T17:00" }, operation.plannedUsers[1]], startDate: "2026-10-10T17:00" });
    expect(value.plannedUsers!.map(row => row.visa.signed)).toEqual([false, true]);
    expectGlobalRevocation(value);
  });

  it("revokes planned visas for a global planned-time edit without changed participant rows", () => {
    const value = revalidateExceptionalOperation(operation, { forecastEndDate: "2026-10-11T09:00" });
    expect(value.plannedUsers!.every(row => !row.visa.signed)).toBe(true);
    expect(value.actualUsers![0].visa.signed).toBe(true);
    expectGlobalRevocation(value);
  });

  it("revokes actual and intervention visas for a global actual-time edit", () => {
    const value = revalidateExceptionalOperation(operation, { actualEndDate: "2026-10-11T09:00" });
    expect(value.actualUsers![0].visa.signed).toBe(false);
    expect(value.interventions![0].agentVisa.signed).toBe(false);
    expectGlobalRevocation(value);
  });

  it("revokes the changed exceptional intervention and global approvals", () => {
    const value = revalidateExceptionalOperation(operation, { interventions: [{ ...operation.interventions[0], userId: "9" }] });
    expect(value.interventions![0].agentVisa.signed).toBe(false);
    expect(value.actualUsers![0].visa.signed).toBe(true);
    expectGlobalRevocation(value);
  });

  it("revokes global approvals when the initiator is replaced", () => {
    expectGlobalRevocation(revalidateExceptionalOperation(operation, { initiatorUid: "9" }));
  });

  it("allows signing an unchanged target without resetting the new signature", () => {
    const empty = { ...operation, plannedUsers: [{ ...participant, visa: createEmptyVisa() }] };
    const value = revalidateExceptionalOperation(empty, { plannedUsers: [participant] });
    expect(value.plannedUsers![0].visa).toBe(visa);
    expect(value.visas).toBe(empty.visas);
  });
});
