import { ExportOperation } from "./rh-export.models";
import { RhJsonExportLibrary } from "./rh-json-export.lib";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const signedVisa = {
  signed: true,
  signedAt: "2026-07-10T20:46:00",
  signedByName: "Agent Test",
  signedByUid: "uid-agent",
  signatureValue: "Signature Agent",
};

const operation: ExportOperation = {
  sourceId: "operation-1",
  sourceCollection: "exceptionalOperations",
  title: "Test JSON",
  exportTitle: "Astreintes exceptionnelles",
  initiatorName: "Initiateur",
  operationManagerName: "Responsable",
  forecastStartDate: "2026-07-04T07:00:00",
  forecastEndDate: "2026-07-05T10:00:00",
  actualStartDate: "2026-07-04T08:00:00",
  actualEndDate: "2026-07-05T11:00:00",
  plannedUsers: [
    {
      name: "Agent Prévu",
      startDate: "2026-07-04T07:00:00",
      endDate: "2026-07-05T10:00:00",
      userId: "planned-user-id",
      visa: signedVisa,
    },
  ],
  actualUsers: [
    {
      name: "Agent Réel",
      startDate: "2026-07-04T08:00:00",
      endDate: "2026-07-05T11:00:00",
      userId: "actual-user-id",
      visa: signedVisa,
    },
  ],
  interventions: [
    {
      userId: "intervention-user-id",
      userName: "Agent Intervention",
      startDate: "2026-07-04T08:30:00",
      endDate: "2026-07-04T09:45:00",
      wasOnSite: true,
      comment: "Contrôle",
      visa: signedVisa,
    },
  ],
  initiatorVisa: signedVisa,
  directorVisa: signedVisa,
};

const library = new RhJsonExportLibrary();
const exceptionalPayload = library.buildPayload("exceptionalOnCall", operation).exceptionalOperations;
const workPayload = library.buildPayload("exceptionalWork", operation).exceptionalOperations;
const json = library.buildJson("regular", operation);

expect(exceptionalPayload.global.title === "Test JSON", "Le JSON doit exposer les informations globales.");
expect(exceptionalPayload.forecast.plannedUsers[0].startDate === "2026-07-04", "Les dates prévisionnelles doivent être découpées.");
expect(exceptionalPayload.forecast.plannedUsers[0].startTime === "07:00:00", "Les heures prévisionnelles doivent être découpées.");
expect(exceptionalPayload.actual?.actualUsers[0].displayName === "Agent Réel", "Les astreintes doivent contenir le bloc réel.");
expect(exceptionalPayload.interventions[0].endTime === "09:45:00", "Les interventions doivent exposer les heures de fin.");
expect(exceptionalPayload.global.initiatorGlobal.signatureValue === "Signature Agent", "Les visas globaux doivent exposer la signature.");

expect(!("actual" in workPayload), "Le modèle travaux exceptionnels ne doit pas exporter de bloc réel.");
expect(workPayload.interventions[0].userName === "Agent Réel", "La clé documentaire historique doit provenir des participants réels des travaux.");
expect(workPayload.forecast.plannedUsers[0].startDate === undefined, "Le modèle travaux ne demande pas les dates par utilisateur prévisionnel.");
expect(workPayload.forecast.plannedUsers[0].visa.signed === true, "Le modèle travaux conserve l'indicateur signed sur les visas agent.");
expect(workPayload.forecast.plannedDirector.signedByName === "Agent Test", "Le modèle travaux expose le signataire des visas globaux prévisionnels.");

expect(json.includes("\"exceptionalOperations\""), "Le JSON sérialisé doit contenir la racine du modèle.");
expect(json.includes("\n  "), "Le JSON doit être indenté pour faciliter le contrôle.");

console.log("rh-json-export.lib: OK");
