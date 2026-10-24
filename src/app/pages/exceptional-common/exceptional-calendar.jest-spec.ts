import { exceptionalCalendarEntries } from "./exceptional-calendar";
import { ExceptionalOperation } from "./exceptional.models";
import { createEmptyVisa } from "../../shared/visa.models";

const visa = createEmptyVisa();
const operation: ExceptionalOperation = {
  id: "astreinte:1", type: "astreinte", title: "Operation", initiatorUid: "7", initiatorName: "Agent",
  operationManagerUid: "7", operationManagerName: "Agent", startDate: "2026-10-10T18:00", forecastEndDate: "2026-10-11T08:00",
  actualStartDate: "2026-10-12T18:00", actualEndDate: "2026-10-13T08:00", plannedUsers: [], actualUsers: [], interventions: [],
  visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa },
};

describe("Exceptional calendar mapping", () => {
  it("uses planning dates without modifying the operation", () => {
    const source = Object.freeze({ ...operation });
    expect(exceptionalCalendarEntries([source])).toEqual([{ id: operation.id, label: operation.title,
      startDate: operation.startDate, endDate: operation.forecastEndDate, disabled: false }]);
    expect(source.actualStartDate).toBe("2026-10-12T18:00");
  });

  it.each([{ sentToRhAt: "2026-10-24T10:00" }, { treatedAt: "2026-10-24T11:00" }])(
    "disables archived calendar entries %j", archive => {
      expect(exceptionalCalendarEntries([{ ...operation, ...archive }])[0].disabled).toBe(true);
    },
  );

  it("falls back to actual dates for historical work and skips operations without dates", () => {
    const source = { ...operation, type: "travaux" as const, startDate: "", forecastEndDate: "" };
    expect(exceptionalCalendarEntries([source])[0]).toMatchObject({ startDate: operation.actualStartDate, endDate: operation.actualEndDate });
    expect(exceptionalCalendarEntries([{ ...source, actualStartDate: "", actualEndDate: "" }])).toEqual([]);
  });
});
