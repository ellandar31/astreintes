import { ExportOperation } from "./rh-export.models";
import { RhJsonExportLibrary } from "./rh-json-export.lib";

const visa = { signed: true, signedAt: "2026-07-10T20:46:00", signedByName: "Agent Test",
  signedByUid: "uid-agent", signatureValue: "Signature Agent" };
const operation: ExportOperation = {
  sourceId: "operation-1", sourceCollection: "exceptionalOperations", title: "Test JSON",
  exportTitle: "Astreintes exceptionnelles", initiatorName: "Initiateur", operationManagerName: "Responsable",
  forecastStartDate: "2026-07-04T07:00:00", forecastEndDate: "2026-07-05T10:00:00",
  actualStartDate: "2026-07-04T08:00:00", actualEndDate: "2026-07-05T11:00:00",
  plannedUsers: [{ name: "Agent Prévu", startDate: "2026-07-04T07:00:00", endDate: "2026-07-05T10:00:00", userId: "planned-user-id", visa }],
  actualUsers: [{ name: "Agent Réel", startDate: "2026-07-04T08:00:00", endDate: "2026-07-05T11:00:00", userId: "actual-user-id", visa }],
  interventions: [{ userId: "intervention-user-id", userName: "Agent Intervention", startDate: "2026-07-04T08:30:00",
    endDate: "2026-07-04T09:45:00", wasOnSite: true, comment: "Contrôle", visa }],
  initiatorVisa: visa, directorVisa: visa,
};

describe("RhJsonExportLibrary", () => {
  const library = new RhJsonExportLibrary();

  it("keeps the on-call JSON contract, date parts and signatures", () => {
    const payload = library.buildPayload("exceptionalOnCall", operation).exceptionalOperations;
    expect(payload.global.title).toBe("Test JSON");
    expect(payload.forecast.plannedUsers[0]).toMatchObject({ startDate: "2026-07-04", startTime: "07:00:00" });
    expect(payload.actual?.actualUsers[0].displayName).toBe("Agent Réel");
    expect(payload.interventions[0].endTime).toBe("09:45:00");
    expect(payload.global.initiatorGlobal.signatureValue).toBe("Signature Agent");
  });

  it("uses actual work participants for the historical document periods", () => {
    const payload = library.buildPayload("exceptionalWork", operation).exceptionalOperations;
    expect(payload).not.toHaveProperty("actual");
    expect(payload.interventions[0].userName).toBe("Agent Réel");
    expect(payload.forecast.plannedUsers[0].startDate).toBeUndefined();
    expect(payload.forecast.plannedUsers[0].visa.signed).toBe(true);
    expect(payload.forecast.plannedDirector.signedByName).toBe("Agent Test");
  });

  it("serializes indented JSON with ISO dates", () => {
    const json = library.buildJson("regular", operation);
    expect(json).toContain('"exceptionalOperations"');
    expect(json).toContain("\n  ");
    expect(JSON.parse(json).exceptionalOperations.global.forecastStartDate).toBe("2026-07-04T07:00:00");
  });

  it.each(["regular", "exceptionalOnCall", "exceptionalWork"] as const)("formats %s document dates without modifying the source", templateId => {
    const snapshot = JSON.stringify(operation);
    const document = library.buildDocumentPayload(templateId, operation).exceptionalOperations;
    expect(document.global.forecastStartDate).toBe("sam 04/07/2026 07:00");
    expect(document.global.directorGlobal.signedAt).toBe("ven 10/07/2026 20:46");
    expect(document.forecast.plannedUsers[0].visa.signedAt).toBe("ven 10/07/2026 20:46");
    expect(document.interventions[0].startDate).toBe("sam 04/07/2026");
    if (document.actual) expect(document.actual.actualUsers[0].endDate).toBe("dim 05/07/2026");
    expect(JSON.stringify(operation)).toBe(snapshot);
    expect(library.buildPayload(templateId, operation).exceptionalOperations.global.forecastStartDate).toBe("2026-07-04T07:00:00");
  });
});
