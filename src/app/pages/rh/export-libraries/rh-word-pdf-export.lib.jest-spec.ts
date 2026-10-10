/** @jest-environment node */
import { ExportOperation, RhExportContext, WordExportTemplate } from "./rh-export.models";
import { RhWordPdfExportLibrary } from "./rh-word-pdf-export.lib";
import { APP_LABELS } from "../../../i18n/labels";

const signedVisa = {
  signed: true,
  signedAt: "2026-07-10T20:46:00",
  signedByName: "Agent Test",
  signedByUid: "uid-agent",
  signatureMode: "draw" as const,
  signatureValue: "data:image/png;base64,signature",
};

const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };
const invalidDrawVisa = {
  signed: true,
  signedAt: "2026-07-11T19:25:00",
  signedByName: "Visa Texte",
  signedByUid: "uid-text",
  signatureMode: "draw" as const,
  signatureValue: "Visa Texte",
};

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

describe("Word and PDF export", () => {
  it("preserves document layout and falls back to text for invalid image visas", () => {
    const library = new RhWordPdfExportLibrary();
    const wordHtml = library.buildWordHtml(template, [operation], "exceptionalOnCall", context);
    const wordHtmlWithInvalidImageVisa = library.buildWordHtml(
      template,
      [
        {
          ...operation,
          initiatorVisa: invalidDrawVisa,
          directorVisa: invalidDrawVisa,
          plannedUsers: [{ name: "Agent Texte", startDate: "2026-07-04T07:00:00", endDate: "2026-07-05T10:00:00", visa: invalidDrawVisa }],
        },
      ],
      "exceptionalOnCall",
      context,
    );

    expect(wordHtml).toContain("Dates prévisionnelles");
    expect(wordHtml).toContain("sam 04/07/2026");
    expect(wordHtml).toContain("ven 10/07/2026");
    expect(wordHtml).toContain("class=\"visa-image\"");
    expect(wordHtml).toContain("width=\"95\" height=\"26\"");
    expect(wordHtml).toContain("class=\"visa-image global-visa-image\"");
    expect(wordHtml).not.toContain("Détail des calculs RH");
    const workHtml = library.buildWordHtml(template, [{ ...operation, interventions: [] }], "exceptionalWork", context);
    expect(workHtml).not.toContain(APP_LABELS.rhDocuments.fields.interventionsDuringOnCall);
    expect(workHtml).toContain(APP_LABELS.rhDocuments.fields.actualDates);

    expect(wordHtmlWithInvalidImageVisa).toContain("Visa Texte");
    expect(wordHtmlWithInvalidImageVisa).not.toContain("src=\"Visa Texte\"");
  });

  it("generates a nonempty PDF Blob without opening a browser window", async () => {
    const pdfBlob = await new RhWordPdfExportLibrary().buildPdfBlob(template, [operation]);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe("application/pdf");
    expect(pdfBlob.size).toBeGreaterThan(0);
  });
});
