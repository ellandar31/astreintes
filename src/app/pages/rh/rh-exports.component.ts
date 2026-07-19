import { CommonModule } from "@angular/common";
import { Component, OnDestroy, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { TableModule } from "primeng/table";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalActions } from "../../state/exceptional/exceptional.actions";
import { selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { RegularActions } from "../../state/regular/regular.actions";
import {
  selectRegularInterventions,
  selectRegularPeriods,
  selectRegularPublicHolidays,
} from "../../state/regular/regular.selectors";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsRhCompensation, selectSettingsRhTemplates } from "../../state/settings/settings.selectors";
import { RhExceptionalOperation, RhRegularPeriod } from "./rh.models";
import { RhExcelExportLibrary } from "./export-libraries/rh-excel-export.lib";
import {
  ExportOperation,
  ExportTemplateId,
  OnCallCompensationRule,
  PeriodCompensationRule,
  RhExportContext,
  WordExportTemplate,
} from "./export-libraries/rh-export.models";
import { formatRange } from "./export-libraries/rh-export-utils";
import { RhWordPdfExportLibrary } from "./export-libraries/rh-word-pdf-export.lib";

interface RegularInterventionExport {
  id: string;
  periodId: string;
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
  readonly labels = APP_LABELS;
  readonly templates: WordExportTemplate[] = [
    { id: "regular", label: APP_LABELS.rh.exports.sections.regular, fileName: "" },
    { id: "exceptionalOnCall", label: APP_LABELS.rh.exports.sections.exceptionalOnCall, fileName: "" },
    { id: "exceptionalWork", label: APP_LABELS.exceptional.types.travaux, fileName: "" },
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

  private readonly wordPdfExportLibrary = new RhWordPdfExportLibrary();
  private readonly excelExportLibrary = new RhExcelExportLibrary();
  private readonly store = inject(Store);
  private readonly exceptionalOperationsSignal = this.store.selectSignal(selectExceptionalOperations);
  private readonly regularInterventionsSignal = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriodsSignal = this.store.selectSignal(selectRegularPeriods);
  private readonly publicHolidaysSignal = this.store.selectSignal(selectRegularPublicHolidays);
  private readonly rhCompensationSignal = this.store.selectSignal(selectSettingsRhCompensation);
  private readonly rhTemplatesSignal = this.store.selectSignal(selectSettingsRhTemplates);

  constructor() {
    this.store.dispatch(SettingsActions.rhCompensationWatchStarted());
    this.store.dispatch(SettingsActions.rhTemplatesWatchStarted());
    this.store.dispatch(RegularActions.watchStarted());
    this.store.dispatch(ExceptionalActions.watchStarted());

    effect(() => {
      const savedTemplates = this.rhTemplatesSignal();

      this.templates.forEach((template) => {
        const savedTemplate = savedTemplates.find((item) => item.id === template.id);
        template.fileName = savedTemplate?.fileName || "";
      });
    });

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
    this.store.dispatch(SettingsActions.rhTemplatesWatchStopped());
    this.store.dispatch(RegularActions.watchStopped());
    this.store.dispatch(ExceptionalActions.watchStopped());
  }

  exportOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    const template = this.templateFor(templateId);

    if (!template.fileName) {
      this.exportMessage = this.labels.rh.exports.errors.missingTemplate;
      return;
    }

    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.doc`,
      "application/msword;charset=utf-8",
      this.wordPdfExportLibrary.buildWordHtml(template, [operation], templateId, this.exportContext()),
    );
    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.wordGenerated, operation.title);
  }

  exportExcelOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
      this.excelExportLibrary.buildExcelHtml(templateId, operation, this.exportContext()),
    );
    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.excelGenerated, operation.title);
  }

  async exportPdfOperation(templateId: ExportTemplateId, operation: ExportOperation): Promise<void> {
    this.exportMessage = "";
    const template = this.templateFor(templateId);

    if (!template.fileName) {
      this.exportMessage = this.labels.rh.exports.errors.missingTemplate;
      return;
    }

    this.downloadBlob(
      `${this.slug(operation.title)}_${this.selectedMonth}.pdf`,
      await this.wordPdfExportLibrary.buildPdfBlob(template, [operation]),
    );
    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.pdfGenerated, operation.title);
  }

  markSentToRh(operation: ExportOperation): void {
    this.exportMessage = "";

    this.dispatchRhSentUpdate(operation, true);

    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.rhSent, operation.title);
  }

  unmarkSentToRh(operation: ExportOperation): void {
    this.exportMessage = "";

    this.dispatchRhSentUpdate(operation, false);

    this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.rhUnsent, operation.title);
  }

  exportRows(templateId: ExportTemplateId): ExportOperation[] {
    return this.operationsForTemplate(templateId);
  }

  templateFor(templateId: ExportTemplateId): WordExportTemplate {
    return this.templates.find((template) => template.id === templateId) || this.templates[0];
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

  private operationsForTemplate(templateId: ExportTemplateId): ExportOperation[] {
    if (templateId === "regular") {
      return this.regularPeriods
        .filter((period) => this.overlapsSelectedMonth(period.startDate, period.endDate))
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
            plannedUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
            actualUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
            interventions: interventions.map((intervention) => ({
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
      .filter((operation) => this.overlapsSelectedMonth(operation.startDate, operation.forecastEndDate || operation.actualEndDate || operation.startDate))
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
          })),
          actualUsers: (operation.actualUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: user.startDate || actualStart,
            endDate: user.endDate || actualEnd,
            visa: user.visa || createEmptyVisa(),
          })),
          interventions: (operation.interventions || []).map((intervention) => ({
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
