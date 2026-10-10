import { CommonModule } from "@angular/common";
import { Component, Input, OnDestroy, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { TableModule } from "primeng/table";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { exceptionalReadyForRh, regularReadyForRh } from "../../shared/visa-workflow";
import { ExceptionalActions } from "../../state/exceptional/exceptional.actions";
import { selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { RegularActions } from "../../state/regular/regular.actions";
import {
  selectRegularInterventions,
  selectRegularPeriods,
  selectRegularPublicHolidays,
} from "../../state/regular/regular.selectors";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectCanExportRh, selectSettingsRhCompensation } from "../../state/settings/settings.selectors";
import { RhExceptionalOperation, RhRegularPeriod } from "./rh.models";
import { RhExcelExportLibrary } from "./export-libraries/rh-excel-export.lib";
import {
  ExportOperation,
  ExportTemplateId,
  OnCallCompensationRule,
  PeriodCompensationRule,
  RhExportContext,
} from "./export-libraries/rh-export.models";
import { formatRange } from "./export-libraries/rh-export-utils";
import { RhExportPeriod, RhPeriodExportOperations } from "../../types/rh-export.models";
import { isValidRhExportPeriod, selectRhPeriodOperations, RhPeriodExcelExportLibrary, RH_EXCEL_MIME } from "./export-libraries/rh-period-excel-export.lib";

interface RegularInterventionExport {
  id: string;
  periodId: string;
  userId?: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment?: string;
  agentVisa?: SignatureVisa;
}

@Component({
  selector: "app-rh-exports",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputTextModule, MessageModule, TableModule],
  templateUrl: "./rh-exports.component.html",
  styleUrl: "./rh-exports.component.css",
})
export class RhExportsComponent implements OnDestroy {
  @Input() periodMode = false;
  readonly periodLabels = APP_LABELS.rhDocuments.periodExport;
  periodStart = `${this.toMonthKey(new Date())}-01`;
  periodEnd = this.localDateKey(new Date());
  exportingPeriod = false;
  readonly labels = APP_LABELS;
  readonly trackExportOperation = (_index: number, operation: ExportOperation): string => `${operation.sourceCollection}:${operation.sourceId}`;
  readonly templates: Array<{ id: ExportTemplateId; label: string }> = [
    { id: "regular", label: APP_LABELS.rh.exports.sections.regular },
    { id: "exceptionalOnCall", label: APP_LABELS.rh.exports.sections.exceptionalOnCall },
    { id: "exceptionalWork", label: APP_LABELS.exceptional.types.travaux },
  ];

  selectedMonth = this.toMonthKey(new Date());
  exportMessage = "";
  regularPeriods: RhRegularPeriod[] = [];
  regularInterventions: RegularInterventionExport[] = [];
  exceptionalOperations: RhExceptionalOperation[] = [];
  publicHolidays: Array<{ id: string; date: string; label: string }> = [];
  onCallCompensationRules: OnCallCompensationRule[] = [
    { id: "week", label: APP_LABELS.rh.rules.week, coefficient: 0 },
    { id: "weekendHoliday", label: APP_LABELS.rh.rules.weekendHoliday, coefficient: 0 },
  ];
  periodCompensationRules: PeriodCompensationRule[] = [
    { id: "week_18_21", label: APP_LABELS.rh.rules.weekEvening, interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "night_21_7", label: APP_LABELS.rh.rules.night, interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "week_7_8", label: APP_LABELS.rh.rules.weekEarly, interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "saturday_7_21", label: APP_LABELS.rh.rules.saturdayDay, interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "sunday_holiday_7_21", label: APP_LABELS.rh.rules.sundayHolidayDay, interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  ];

  private readonly excelExportLibrary = new RhExcelExportLibrary();
  private readonly store = inject(Store);
  readonly canExport = this.store.selectSignal(selectCanExportRh);
  private readonly exceptionalOperationsSignal = this.store.selectSignal(selectExceptionalOperations);
  private readonly regularInterventionsSignal = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriodsSignal = this.store.selectSignal(selectRegularPeriods);
  private readonly publicHolidaysSignal = this.store.selectSignal(selectRegularPublicHolidays);
  private readonly rhCompensationSignal = this.store.selectSignal(selectSettingsRhCompensation);

  constructor() {
    this.store.dispatch(SettingsActions.rhCompensationWatchStarted());
    this.store.dispatch(RegularActions.watchStarted());
    this.store.dispatch(ExceptionalActions.watchStarted());

    effect(() => {
      const settings = this.rhCompensationSignal();

      if (!settings) {
        return;
      }

      this.onCallCompensationRules = this.mergeRows(this.onCallCompensationRules, settings.onCall);
      this.periodCompensationRules = this.mergeRows(this.periodCompensationRules, settings.periods);
    });

    effect(() => {
      this.regularPeriods = this.regularPeriodsSignal() as RhRegularPeriod[];
    });

    effect(() => {
      this.regularInterventions = this.regularInterventionsSignal() as RegularInterventionExport[];
    });

    effect(() => {
      this.exceptionalOperations = this.exceptionalOperationsSignal() as RhExceptionalOperation[];
    });

    effect(() => {
      this.publicHolidays = this.publicHolidaysSignal();
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(SettingsActions.rhCompensationWatchStopped());
    this.store.dispatch(RegularActions.watchStopped());
    this.store.dispatch(ExceptionalActions.watchStopped());
  }

  exportExcelOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    if (!this.canExport()) return;
    this.exportMessage = "";
    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
      this.excelExportLibrary.buildExcelHtml(templateId, operation, this.exportContext()),
    );
    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.excelGenerated, operation.title);
  }

  markSentToRh(operation: ExportOperation): void {
    if (!this.canExport()) return;
    this.exportMessage = "";

    if (!this.canSendToRh(operation)) {
      this.exportMessage = this.labels.validation.messages.rhPrerequisites;
      return;
    }

    this.dispatchRhSentUpdate(operation, true);

    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.rhSent, operation.title);
  }

  /** Check live source objects, not an export snapshot captured before a visa removal. */
  canSendToRh(operation: ExportOperation): boolean {
    if (!this.canExport()) return false;
    if (operation.sourceCollection === "exceptionalOperations") {
      const source = this.exceptionalOperations.find(item => item.id === operation.sourceId);
      return Boolean(source && !source.sentToRhAt && exceptionalReadyForRh(source));
    }
    const period = this.regularPeriods.find(item => item.id === operation.sourceId);
    const interventions = this.regularInterventions.filter(item => item.periodId === operation.sourceId);
    return Boolean(period && !period.sentToRhAt && regularReadyForRh(period, interventions));
  }

  unmarkSentToRh(operation: ExportOperation): void {
    if (!this.canExport()) return;
    this.exportMessage = "";

    this.dispatchRhSentUpdate(operation, false);

    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.rhUnsent, operation.title);
  }

  exportRows(templateId: ExportTemplateId): ExportOperation[] {
    return this.operationsForTemplate(templateId);
  }

  get exportPeriod(): RhExportPeriod {
    return { startDate: this.periodStart, endDate: this.periodEnd };
  }

  get validExportPeriod(): boolean { return isValidRhExportPeriod(this.exportPeriod); }

  /** Uses all loaded operations: execution month must not limit submission-based exports. */
  periodOperations(): RhPeriodExportOperations {
    return {
      regular: this.operationsForTemplate("regular", false),
      exceptionalOnCall: this.operationsForTemplate("exceptionalOnCall", false),
      exceptionalWork: this.operationsForTemplate("exceptionalWork", false),
    };
  }

  periodOperationCount(templateId: ExportTemplateId): number {
    return selectRhPeriodOperations(this.periodOperations(), this.exportPeriod)[templateId].length;
  }

  /** Capture bounds and data before the asynchronous download; always release the busy state. */
  async exportExcelPeriod(): Promise<void> {
    if (!this.canExport()) return;
    if (this.exportingPeriod) return;
    this.exportMessage = "";
    if (!this.validExportPeriod) { this.exportMessage = this.periodLabels.invalidPeriod; return; }
    const period = this.exportPeriod;
    const operations = this.periodOperations();
    const selected = selectRhPeriodOperations(operations, period);
    if (!Object.values(selected).some(items => items.length)) { this.exportMessage = this.periodLabels.empty; return; }
    this.exportingPeriod = true;
    try {
      const data = await new RhPeriodExcelExportLibrary().buildWorkbook(operations, period, this.exportContext());
      this.downloadBlob(`rh_${period.startDate}_${period.endDate}.xlsx`, new Blob([new Uint8Array(data)], { type: RH_EXCEL_MIME }));
      this.exportMessage = this.periodLabels.success;
    } catch {
      this.exportMessage = this.periodLabels.failure;
    } finally { this.exportingPeriod = false; }
  }

  private localDateKey(date: Date): string {
    return `${this.toMonthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
  }

  formatRange(startValue: string, endValue: string): string {
    return formatRange(startValue, endValue);
  }

  private exportContext(): RhExportContext {
    return {
      publicHolidays: this.publicHolidays,
      onCallCompensationRules: this.onCallCompensationRules,
      periodCompensationRules: this.periodCompensationRules,
    };
  }

  private operationsForTemplate(templateId: ExportTemplateId, filterExecutionMonth = true): ExportOperation[] {
    if (templateId === "regular") {
      return this.regularPeriods
        .filter((period) => !filterExecutionMonth || this.overlapsSelectedMonth(period.startDate, period.endDate))
        .sort((first, second) => first.startDate.localeCompare(second.startDate))
        .map((period) => {
          const interventions = this.regularInterventions
            .filter((intervention) => intervention.periodId === period.id)
            .sort((first, second) => first.startDate.localeCompare(second.startDate));

          return {
            sourceId: period.id,
            sourceCollection: "regularOnCallPeriods",
            title: `${this.labels.rh.controls.types.regularOnCall} - ${period.userName || period.userEmail}`,
            exportTitle: this.labels.rh.controls.types.regularOnCallPlural,
            initiatorName: "",
            operationManagerName: "",
            forecastStartDate: period.startDate,
            forecastEndDate: period.endDate,
            actualStartDate: period.startDate,
            actualEndDate: period.endDate,
            plannedUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa(), userId: period.userId }],
            actualUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa(), userId: period.userId }],
            interventions: interventions.map((intervention) => ({
              userId: intervention.userId,
              userName: intervention.userName || intervention.userEmail,
              startDate: intervention.startDate,
              endDate: intervention.endDate,
              wasOnSite: false,
              comment: intervention.comment || "",
              visa: intervention.agentVisa || createEmptyVisa(),
            })),
            initiatorVisa: createEmptyVisa(),
            directorVisa: period.directorVisa || createEmptyVisa(),
            sentToRhAt: period.sentToRhAt,
          };
        });
    }

    const operationType = templateId === "exceptionalOnCall" ? "astreinte" : "travaux";
    const exportTitle = templateId === "exceptionalOnCall"
      ? this.labels.rh.controls.types.exceptionalOnCall
      : this.labels.rh.controls.types.exceptionalWork;

    return this.exceptionalOperations
      .filter((operation) => operation.type === operationType)
      .filter((operation) => !filterExecutionMonth || this.overlapsSelectedMonth(operation.startDate, operation.forecastEndDate || operation.actualEndDate || operation.startDate))
      .sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""))
      .map((operation) => {
        const forecastStart = operation.startDate || "";
        const forecastEnd = operation.forecastEndDate || operation.startDate || "";
        const actualStart = operation.actualStartDate || forecastStart;
        const actualEnd = operation.actualEndDate || forecastEnd;

        return {
          sourceId: operation.id,
          sourceCollection: "exceptionalOperations",
          title: operation.title || exportTitle,
          exportTitle,
          initiatorName: operation.initiatorName || "",
          operationManagerName: operation.operationManagerName || "",
          forecastStartDate: forecastStart,
          forecastEndDate: forecastEnd,
          actualStartDate: actualStart,
          actualEndDate: actualEnd,
          plannedUsers: (operation.plannedUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: user.startDate || forecastStart,
            endDate: user.endDate || forecastEnd,
            visa: user.visa || createEmptyVisa(),
            userId: user.userId,
          })),
          actualUsers: (operation.actualUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: user.startDate || actualStart,
            endDate: user.endDate || actualEnd,
            visa: user.visa || createEmptyVisa(),
            userId: user.userId,
          })),
          interventions: (operation.interventions || []).map((intervention) => ({
            userId: intervention.userId,
            userName: intervention.userName || intervention.userEmail,
            startDate: intervention.startDate || intervention.date || "",
            endDate: intervention.endDate || "",
            wasOnSite: Boolean(intervention.wasOnSite),
            comment: intervention.comment || intervention.label || "",
            visa: intervention.agentVisa || createEmptyVisa(),
          })),
          initiatorVisa: operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || operation.visas?.plannedInitiator || createEmptyVisa(),
          directorVisa: operation.visas?.directorGlobal || operation.visas?.actualDirector || operation.visas?.plannedDirector || createEmptyVisa(),
          sentToRhAt: operation.sentToRhAt,
        };
      });
  }

  private overlapsSelectedMonth(startValue: string, endValue: string): boolean {
    const { start, end } = this.monthRange(this.selectedMonth);
    const itemStart = new Date(startValue);
    const itemEnd = new Date(endValue || startValue);
    return itemStart < end && itemEnd >= start;
  }

  private dispatchRhSentUpdate(operation: ExportOperation, sent: boolean): void {
    if (operation.sourceCollection === "exceptionalOperations") {
      this.store.dispatch(ExceptionalActions.operationRhSentUpdateRequested({ operationId: operation.sourceId, sent }));
      return;
    }

    this.store.dispatch(RegularActions.periodRhSentUpdateRequested({ periodId: operation.sourceId, sent }));
  }

  private formatMessage(template: string, title: string): string {
    return template.replace("{title}", title);
  }

  private monthRange(monthKey: string): { start: Date; end: Date } {
    const [year, month] = monthKey.split("-").map(Number);
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => {
      const savedRow = savedRows.find((row) => row.id === defaultRow.id);
      return savedRow ? { ...defaultRow, ...savedRow } : defaultRow;
    });
  }

  private downloadFile(fileName: string, type: string, content: string): void {
    const blob = new Blob(["\ufeff", content], { type });
    this.downloadBlob(fileName, blob);
  }

  private downloadBlob(fileName: string, blob: Blob): void {
    // Revérifier les droits après une génération asynchrone avant le téléchargement.
    if (!this.canExport()) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private slug(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }
}
