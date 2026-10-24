import { Workbook } from "exceljs";
import { APP_LABELS } from "../../../i18n/labels";
import { ExportOperation, RhExportContext } from "./rh-export.models";
import { RhExcelExportLibrary } from "./rh-excel-export.lib";

function operationFixture(): ExportOperation {
  const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };

  return {
    sourceId: "regular-1",
    sourceCollection: "regularOnCallPeriods",
    title: "Astreinte export",
    exportTitle: "Astreintes régulières",
    initiatorName: "Initiateur",
    operationManagerName: "Responsable",
    forecastStartDate: "2026-07-03T18:00:00",
    forecastEndDate: "2026-07-06T08:00:00",
    actualStartDate: "2026-07-03T18:00:00",
    actualEndDate: "2026-07-06T08:00:00",
    plannedUsers: [{ name: "Agent Test", startDate: "2026-07-03T18:00:00", endDate: "2026-07-06T08:00:00", visa: unsignedVisa }],
    actualUsers: [{ name: "Agent Test", startDate: "2026-07-03T18:00:00", endDate: "2026-07-06T08:00:00", visa: unsignedVisa }],
    interventions: [
      {
        userName: "Agent Test",
        startDate: "2026-07-04T07:00:00",
        endDate: "2026-07-04T10:00:00",
        wasOnSite: true,
        comment: "Contrôle",
        visa: unsignedVisa,
      },
    ],
    initiatorVisa: unsignedVisa,
    directorVisa: unsignedVisa,
  };
}

function contextFixture(): RhExportContext {
  return {
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
}

describe("Individual Excel export", () => {
  it.each(["regular", "exceptionalOnCall", "exceptionalWork"] as const)("generates a real separate XLSX sheets for %s", async template => {
    const operation = { ...operationFixture(), treatedAt: "2026-10-02T14:30:00", sentToRhAt: "2026-10-01T10:00:00" };
    const bytes = await new RhExcelExportLibrary().buildWorkbook(template, operation, contextFixture());
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(bytes));
    expect(workbook.worksheets).toHaveLength(template === "exceptionalWork" ? 1 : 2);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe(APP_LABELS.rhDocuments.periodExport.sheets[template]);
    expect(sheet.getColumn("L").width).toBeGreaterThanOrEqual(80);
    expect(sheet.getCell("O1").text).toBe(APP_LABELS.rhDocuments.periodExport.treatedAt);
    expect(sheet.getCell("O2").text).toBe("ven 02/10/2026 14:30");
    expect(sheet.getCell("B2").text).toBe(operation.title);
    const values = workbook.worksheets.flatMap(worksheet => worksheet.getSheetValues().flat(2)).join(" ");
    expect(values).toContain("Agent Test");
    expect(values).toContain("Samedi (7h-21h)");
    if (template !== "exceptionalWork") {
      expect(values).toContain("Samedi / dimanche / jour férié :");
      expect(values).toContain("Contrôle");
      const interventionSheet = workbook.worksheets[1];
      expect(interventionSheet.name).toBe(APP_LABELS.rhDocuments.periodExport.interventionSheets[template]);
      expect(interventionSheet.getCell("N2").text).toBe("Contrôle");
      expect(sheet.getColumn("N").values).not.toContain("Contrôle");
      expect(interventionSheet.getColumn("I").values).not.toContain(APP_LABELS.rhDocuments.sections.onCall);
    }
    expect(sheet.getCell("L2").alignment.wrapText).toBe(true);
  });

  it("preserves short-period calculations and leaves cancelled treatment blank", async () => {
    const operation = { ...operationFixture(), actualUsers: [{ name: "Agent sans intervention",
      startDate: "2026-10-01T22:41:00", endDate: "2026-10-01T23:00:00", visa: operationFixture().directorVisa }], interventions: [] };
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await new RhExcelExportLibrary().buildWorkbook("regular", operation, contextFixture())));
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell("A2").text).toBe("Agent sans intervention");
    expect(sheet.getCell("L2").text).toContain("= 0.32 h");
    expect(sheet.getCell("O2").text).toBe("");
  });
});
