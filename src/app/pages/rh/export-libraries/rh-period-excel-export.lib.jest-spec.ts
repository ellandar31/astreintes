import { Workbook } from "exceljs";
import { APP_LABELS } from "../../../i18n/labels";
import { createEmptyVisa } from "../../../shared/visa.models";
import { ExportOperation, RhExportContext, RhPeriodExportOperations } from "../../../types/rh-export.models";
import { isValidRhExportPeriod, selectRhPeriodOperations, RhPeriodExcelExportLibrary } from "./rh-period-excel-export.lib";

const period = { startDate: "2026-10-01", endDate: "2026-10-31" };
const visa = { ...createEmptyVisa(), signed: true, signedByName: "Directeur Test" };
const operation: ExportOperation = {
  sourceId: "1", sourceCollection: "exceptionalOperations", title: "Opération Test", exportTitle: "Test",
  initiatorName: "Initiateur", operationManagerName: "Responsable",
  forecastStartDate: "2026-07-06T18:00", forecastEndDate: "2026-07-06T20:00",
  actualStartDate: "2026-07-06T18:00", actualEndDate: "2026-07-06T20:00",
  plannedUsers: [], actualUsers: [{ name: "Agent Test", startDate: "2026-07-06T18:00", endDate: "2026-07-06T20:00", visa }],
  interventions: [], initiatorVisa: visa, directorVisa: visa, sentToRhAt: "2026-10-01T00:00:00",
};
const context: RhExportContext = {
  publicHolidays: [], onCallCompensationRules: [{ id: "week", label: "Semaine", coefficient: 2 }],
  periodCompensationRules: [{ id: "week_18_21", label: "Soirée", interventionCoefficient: 3, workCoefficient: 4, restCoefficient: 0 }],
};
const operations: RhPeriodExportOperations = { regular: [operation], exceptionalOnCall: [operation], exceptionalWork: [operation] };

describe("RH period workbook", () => {
  it("selects by submission dates, inclusively, independently of execution", () => {
    const items = [operation, { ...operation, sentToRhAt: "2026-10-31T23:59:59" },
      { ...operation, sentToRhAt: "2026-11-01T00:00:00" }, { ...operation, sentToRhAt: undefined },
      { ...operation, sentToRhAt: "invalid" }];
    expect(selectRhPeriodOperations({ ...operations, regular: items }, period).regular).toHaveLength(2);
  });

  it.each([
    { startDate: "", endDate: "2026-10-31" },
    { startDate: "2026-10-31", endDate: "2026-10-01" },
    { startDate: "2026-02-30", endDate: "2026-10-31" },
  ])("rejects invalid bounds %j", bounds => expect(isValidRhExportPeriod(bounds)).toBe(false));

  it("creates a readable XLSX with five sheets and complete row metadata", async () => {
    const buffer = await new RhPeriodExcelExportLibrary().buildWorkbook(operations, period, context);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(buffer));
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      APP_LABELS.rhDocuments.periodExport.sheets.regular,
      APP_LABELS.rhDocuments.periodExport.interventionSheets.regular,
      APP_LABELS.rhDocuments.periodExport.sheets.exceptionalOnCall,
      APP_LABELS.rhDocuments.periodExport.interventionSheets.exceptionalOnCall,
      APP_LABELS.rhDocuments.periodExport.sheets.exceptionalWork,
    ]);
    for (const sheet of [workbook.worksheets[0], workbook.worksheets[2], workbook.worksheets[4]]) {
      const values = sheet.getRow(2).values;
      expect(values).toEqual(expect.arrayContaining(["Agent Test", "Opération Test", "Directeur Test", "jeu 01/10/2026 00:00", 2]));
      expect(sheet.getCell("L2").text).toContain("= 2 h");
      expect(sheet.getCell("L2").alignment.wrapText).toBe(true);
      expect(sheet.rowCount).toBe(2);
    }
    expect(workbook.worksheets[2].columnCount).toBe(15);
    expect(workbook.worksheets[2].getCell("N1").value).toBe(APP_LABELS.rhDocuments.fields.comment);
  });

  it("includes treatment dates in detail and fallback rows, leaving cancelled treatment blank", async () => {
    const treated = { ...operation, treatedAt: "2026-10-02T14:30:00" };
    const fallback = { ...treated, actualUsers: [] };
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await new RhPeriodExcelExportLibrary().buildWorkbook({
      regular: [treated], exceptionalOnCall: [fallback], exceptionalWork: [operation],
    }, period, context)));
    for (const sheet of workbook.worksheets) {
      expect(sheet.getCell("O1").value).toBe(APP_LABELS.rhDocuments.periodExport.treatedAt);
    }
    expect(workbook.worksheets[0].getCell("O2").value).toBe("ven 02/10/2026 14:30");
    expect(workbook.worksheets[2].getCell("O2").value).toBe("ven 02/10/2026 14:30");
    expect(workbook.worksheets[4].getCell("O2").value).toBe("");
  });

  it("keeps headers in empty sheets and does not modify the source", async () => {
    const snapshot = JSON.stringify(operations);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await new RhPeriodExcelExportLibrary().buildWorkbook(
      { regular: [], exceptionalOnCall: [], exceptionalWork: [] }, period, context)));
    expect(workbook.worksheets.every(sheet => sheet.rowCount === 1)).toBe(true);
    expect(JSON.stringify(operations)).toBe(snapshot);
  });

  it("repeats metadata for interventions and keeps operations with no eligible hours", async () => {
    const noHours = { ...operation, actualUsers: [{ ...operation.actualUsers[0], startDate: "2026-07-06T10:00", endDate: "2026-07-06T12:00" }] };
    const withIntervention = { ...operation, interventions: [{ userName: "Intervenant", startDate: "2026-07-06T18:00",
      endDate: "2026-07-06T19:00", wasOnSite: true, comment: "Commentaire", visa }] };
    const snapshot = JSON.stringify(withIntervention);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await new RhPeriodExcelExportLibrary().buildWorkbook(
      { regular: [noHours], exceptionalOnCall: [withIntervention], exceptionalWork: [] }, period, context)));
    expect(workbook.worksheets[0].getCell("M2").value).toBe(0);
    expect(workbook.worksheets[0].getCell("N2").value).toBe("");
    expect(workbook.worksheets[0].columnCount).toBe(15);
    expect(workbook.worksheets[1].rowCount).toBe(1);
    expect(workbook.worksheets[2].rowCount).toBe(2);
    expect(workbook.worksheets[3].rowCount).toBe(2);
    expect(workbook.worksheets[2].getCell("A2").value).toBe("Agent Test");
    expect(workbook.worksheets[3].getCell("A2").value).toBe("Intervenant");
    expect(workbook.worksheets[3].getCell("C2").value).toBe("Directeur Test");
    expect(workbook.worksheets[3].getCell("N2").value).toBe("Commentaire");
    expect(JSON.stringify(withIntervention)).toBe(snapshot);
  });
});
