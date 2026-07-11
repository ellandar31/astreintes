import { ExportOperation, RhExportContext, WordExportTemplate } from "./rh-export.models";
import { RhWordPdfExportLibrary } from "./rh-word-pdf-export.lib";

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
  signatureMode: "draw" as const,
  signatureValue: "data:image/png;base64,signature",
};

const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };

const operation: ExportOperation = {
  sourceId: "exceptional-1",
  sourceCollection: "exceptionalOperations",
  title: "Opération export",
  exportTitle: "Astreintes exceptionnelles",
  initiatorName: "Initiateur",
  operationManagerName: "Responsable",
  forecastStartDate: "2026-07-04T07:00:00",
  forecastEndDate: "2026-07-05T10:00:00",
  actualStartDate: "2026-07-04T07:00:00",
  actualEndDate: "2026-07-05T10:00:00",
  plannedUsers: [{ name: "Agent Test", startDate: "2026-07-04T07:00:00", endDate: "2026-07-05T10:00:00", visa: signedVisa }],
  actualUsers: [{ name: "Agent Test", startDate: "2026-07-04T07:00:00", endDate: "2026-07-05T10:00:00", visa: signedVisa }],
  interventions: [
    {
      userName: "Agent Test",
      startDate: "2026-07-04T08:00:00",
      endDate: "2026-07-04T09:00:00",
      wasOnSite: true,
      comment: "Intervention",
      visa: signedVisa,
    },
  ],
  initiatorVisa: signedVisa,
  directorVisa: unsignedVisa,
};

const template: WordExportTemplate = { id: "exceptionalOnCall", label: "Astreintes exceptionnelles", fileName: "modele.docx" };
const context: RhExportContext = {
  publicHolidays: [],
  onCallCompensationRules: [
    { id: "week", label: "Semaine", coefficient: 1 },
    { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 2 },
  ],
  periodCompensationRules: [
    { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 1, workCoefficient: 2, restCoefficient: 0 },
    { id: "night_21_7", label: "Nuit (21h-7h)", interventionCoefficient: 1.5, workCoefficient: 2.5, restCoefficient: 0 },
    { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 1, workCoefficient: 2, restCoefficient: 0 },
    { id: "saturday_7_21", label: "Samedi (7h-21h)", interventionCoefficient: 2, workCoefficient: 3, restCoefficient: 1 },
    { id: "sunday_holiday_7_21", label: "Dimanche/Jours fériés (7h-21h)", interventionCoefficient: 2, workCoefficient: 3, restCoefficient: 1 },
  ],
};

const library = new RhWordPdfExportLibrary();
const wordHtml = library.buildWordHtml(template, [operation], "exceptionalOnCall", context);

expect(wordHtml.includes("Dates prévisionnelles"), "Le Word doit contenir le tableau des dates prévisionnelles.");
expect(wordHtml.includes("class=\"visa-image\""), "Les signatures image/pad doivent être rendues en image dans le Word.");
expect(wordHtml.includes("width=\"95\" height=\"26\""), "Les visas de ligne doivent être retaillés pour préserver la mise en page Word.");
expect(wordHtml.includes("class=\"visa-image global-visa-image\""), "Les visas globaux doivent utiliser la taille dédiée.");
expect(!wordHtml.includes("Détail des calculs RH"), "Le Word ne doit pas inclure le bloc de détail des calculs RH.");

async function main(): Promise<void> {
  const pdfBlob = await library.buildPdfBlob(template, [operation]);

  expect(pdfBlob instanceof Blob, "Le PDF doit être généré sous forme de Blob.");
  expect(pdfBlob.type === "application/pdf", "Le Blob PDF doit utiliser le type application/pdf.");
  expect(pdfBlob.size > 0, "Le PDF généré ne doit pas être vide.");

  console.log("rh-word-pdf-export.lib: OK");
}

main().catch((error) => {
  console.error(error);
  throw error;
});
