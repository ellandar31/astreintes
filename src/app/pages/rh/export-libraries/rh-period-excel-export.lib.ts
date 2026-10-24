import type { Worksheet } from "exceljs";
import { APP_LABELS } from "../../../i18n/labels";
import { ExportOperation, ExportTemplateId, RhExportContext, RhExportPeriod, RhPeriodExportOperations } from "../../../types/rh-export.models";
import { RhExportCalculationLibrary } from "./rh-export-calculations";
import { formatOptionalDateTime, formatRange, toDateKey } from "./rh-export-utils";

type ExportPart = "onCall" | "interventions" | "work";

const labels = APP_LABELS.rhDocuments;
const periodLabels = labels.periodExport;
export const RH_EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Inclusive local calendar dates keep the selection consistent with the RH UI. */
export function isValidRhExportPeriod(period: RhExportPeriod): boolean {
  const validDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
  };
  return validDate(period.startDate) && validDate(period.endDate) && period.startDate <= period.endDate;
}

/** Submission alone determines inclusion; missing or malformed timestamps are excluded. */
export function selectRhPeriodOperations(operations: RhPeriodExportOperations, period: RhExportPeriod): RhPeriodExportOperations {
  const select = (items: ExportOperation[]): ExportOperation[] => items.filter(operation => {
    if (!isValidRhExportPeriod(period) || !operation.sentToRhAt) return false;
    const sent = new Date(operation.sentToRhAt);
    if (Number.isNaN(sent.getTime())) return false;
    const day = toDateKey(sent);
    return day >= period.startDate && day <= period.endDate;
  }).sort((a, b) => (a.sentToRhAt ?? "").localeCompare(b.sentToRhAt ?? "") || a.title.localeCompare(b.title));
  return { regular: select(operations.regular), exceptionalOnCall: select(operations.exceptionalOnCall), exceptionalWork: select(operations.exceptionalWork) };
}

/** Builds real XLSX workbooks with shared columns and calculation rules for all RH exports. */
export class RhPeriodExcelExportLibrary {
  /** Lazy loading keeps the workbook dependency off the application's initial bundle. */
  async buildWorkbook(operations: RhPeriodExportOperations, period: RhExportPeriod, context: RhExportContext): Promise<Uint8Array> {
    if (!isValidRhExportPeriod(period)) throw new Error(periodLabels.invalidPeriod);
    return this.buildSelectedWorkbook(selectRhPeriodOperations(operations, period), ["regular", "exceptionalOnCall", "exceptionalWork"], context);
  }

  /** Individual exports share the XLSX layout, widths and calculation rules with period exports. */
  async buildOperationWorkbook(type: ExportTemplateId, operation: ExportOperation, context: RhExportContext): Promise<Uint8Array> {
    const selected: RhPeriodExportOperations = { regular: [], exceptionalOnCall: [], exceptionalWork: [] };
    selected[type] = [operation];
    return this.buildSelectedWorkbook(selected, [type], context);
  }

  private async buildSelectedWorkbook(selected: RhPeriodExportOperations, types: ExportTemplateId[], context: RhExportContext): Promise<Uint8Array> {
    // The production browser chunk exposes ExcelJS through its CommonJS default export.
    // Named imports happen to work with the dev/Jest loaders but fail after code splitting.
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const calculator = new RhExportCalculationLibrary(context);
    for (const type of types) {
      const parts: ExportPart[] = type === "exceptionalWork" ? ["work"] : ["onCall", "interventions"];
      for (const part of parts) {
        const sheetName = part === "interventions" && type !== "exceptionalWork"
          ? periodLabels.interventionSheets[type] : periodLabels.sheets[type];
        const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
        const headers = [labels.fields.user, periodLabels.operation, periodLabels.director, periodLabels.rhSent,
          labels.fields.initiator, labels.fields.manager, labels.fields.forecastPeriod, labels.fields.actualPeriod,
          periodLabels.category, labels.fields.range, labels.fields.indemnityType, labels.fields.calculationDetail,
          labels.fields.hours, labels.fields.comment, periodLabels.treatedAt];
        // Wide identity/detail columns wrap; dates and numeric totals remain compact.
        const widths = [60, 38, 28, 25, 28, 28, 48, 48, 28, 48, 32, 85, 12, 40, 25];
        sheet.columns = headers.map((header, index) => ({ header, width: widths[index] }));
        for (const operation of selected[type]) {
          this.appendOperation(sheet, type, part, operation, calculator);
        }
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
        sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
      }
    }
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }

  /** Metadata is repeated on every detail row so filtering never loses its approval context. */
  private appendOperation(sheet: Worksheet, type: ExportTemplateId, part: ExportPart, operation: ExportOperation, calculator: RhExportCalculationLibrary): void {
    const firstRowCount = sheet.rowCount;
    const common = [operation.title, operation.directorVisa.signed ? operation.directorVisa.signedByName : "",
      formatOptionalDateTime(operation.sentToRhAt), operation.initiatorName,
      operation.operationManagerName, formatRange(operation.forecastStartDate, operation.forecastEndDate),
      formatRange(operation.actualStartDate, operation.actualEndDate)];
    if (part === "onCall") {
      for (const row of calculator.onCallCompensationRows(operation)) {
        sheet.addRow([row.name, ...common, labels.sections.onCall, formatRange(row.startDate, row.endDate),
          row.label, calculator.segmentDetails(row.segments), row.hours, "", formatOptionalDateTime(operation.treatedAt)]);
      }
    }
    if (part !== "onCall") {
      const category = type === "exceptionalWork" ? periodLabels.sheets.exceptionalWork : labels.sections.interventionsAndWork;
      for (const row of calculator.interventionCompensationRows(operation, type === "exceptionalWork")) {
        sheet.addRow([row.userName, ...common, category, formatRange(row.startDate, row.endDate),
          row.label, calculator.segmentDetails(row.segments), row.hours, row.comment, formatOptionalDateTime(operation.treatedAt)]);
      }
    }
    // A zero-hour operation remains traceable on its main sheet; an empty intervention
    // sheet must not invent an intervention from the on-call participants.
    if (part !== "interventions" && sheet.rowCount === firstRowCount) this.appendFallbackRows(sheet, type, operation, common, calculator);
  }

  /** Keep sent operations traceable without inventing participants or substituting forecast hours. */
  private appendFallbackRows(sheet: Worksheet, type: ExportTemplateId, operation: ExportOperation, common: string[], calculator: RhExportCalculationLibrary): void {
    const participants = operation.actualUsers.length ? operation.actualUsers : [{ name: APP_LABELS.common.empty.noUser,
      startDate: operation.actualStartDate, endDate: operation.actualEndDate }];
    for (const user of participants) {
      sheet.addRow([user.name, ...common, periodLabels.sheets[type], formatRange(user.startDate, user.endDate),
        "", calculator.segmentDetails([]), 0, "", formatOptionalDateTime(operation.treatedAt)]);
    }
  }
}
