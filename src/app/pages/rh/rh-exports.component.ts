import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, OnDestroy, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { CheckboxChangeEvent, CheckboxModule } from "primeng/checkbox";
import { SelectModule } from "primeng/select";
import { SharedTableModule } from "../../shared/shared-table.module";
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
import { selectSettingsState, selectCanExportRh, selectSettingsRhCompensation } from "../../state/settings/settings.selectors";
import { RhExceptionalOperation, RhRegularPeriod } from "./rh.models";
import { RhExcelExportLibrary } from "./export-libraries/rh-excel-export.lib";
import {
  ExportOperation,
  ExportTemplateId,
  OnCallCompensationRule,
  PeriodCompensationRule,
  RhExportContext,
} from "./export-libraries/rh-export.models";
import { formatRhExportUser } from "./export-libraries/rh-export-user-label";
import { formatRange } from "./export-libraries/rh-export-utils";
import { RhExportPeriod, RhPeriodExportOperations } from "../../types/rh-export.models";
import { isValidRhExportPeriod, selectRhPeriodOperations, RhPeriodExcelExportLibrary, RH_EXCEL_MIME } from "./export-libraries/rh-period-excel-export.lib";

/** Cached table fields keep displayed text searchable and dates chronologically sortable. */
interface PeriodExportRow {
  templateId: ExportTemplateId;
  typeLabel: string;
  operation: ExportOperation;
  periodLabel: string;
  startDate: Date;
  sentDate: Date | null;
  treatedDate: Date | null;
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TableColumnHeaderComponent, TableRowsPipe, ButtonModule, CardModule, CommonModule, FormsModule, InputTextModule, MessageModule, CheckboxModule, SelectModule, SharedTableModule],
  templateUrl: "./rh-exports.component.html",
  styleUrl: "./rh-exports.component.css",
})
export class RhExportsComponent implements OnDestroy {
  readonly exportTableFields = {
    tableStartDate: (row: ExportOperation) => tableDate(row.forecastStartDate),
    tablePeriod: (row: ExportOperation) => formatRange(row.forecastStartDate, row.forecastEndDate),
  };
  @Input() periodMode = false;
  private readonly userModeState = signal(false);
  @Input() set userMode(value: boolean) { this.userModeState.set(value); }
  get userMode(): boolean { return this.userModeState(); }
  private readonly selectedUserState = signal<string | null>(null);
  set selectedUserId(value: string | null) { this.selectedUserState.set(value); }
  get selectedUserId(): string | null { return this.selectedUserState(); }
  readonly periodLabels = APP_LABELS.rhDocuments.periodExport;
  private readonly periodStartState = signal(`${this.toMonthKey(new Date())}-01`);
  private readonly periodEndState = signal(this.localDateKey(new Date()));
  set periodStart(value: string) { this.periodStartState.set(value); }
  get periodStart(): string { return this.periodStartState(); }
  set periodEnd(value: string) { this.periodEndState.set(value); }
  get periodEnd(): string { return this.periodEndState(); }
  exportingPeriod = false;
  private readonly exportingOperationState = signal<string | null>(null);
  get exportingOperationKey(): string | null { return this.exportingOperationState(); }
  set exportingOperationKey(value: string | null) { this.exportingOperationState.set(value); }
  selectedOperationKeys = new Set<string>();
  private readonly settingsState = inject(Store).selectSignal(selectSettingsState);
  get treatmentPending(): boolean { return this.settingsState()?.isSaving ?? false; }
  get treatmentMessage(): string {
    const message = this.settingsState()?.message;
    return message?.source === "rhTreatment" ? message.message : "";
  }

  operationKey(operation: ExportOperation): string { return `${operation.sourceCollection}:${operation.sourceId}`; }

  selectOperation(operation: ExportOperation, event: CheckboxChangeEvent): void {
    const key = this.operationKey(operation);
    if (event.checked) this.selectedOperationKeys.add(key);
    else this.selectedOperationKeys.delete(key);
  }

  get selectedUntreatedCount(): number {
    return this.periodExportRows().filter(row => !row.operation.treatedAt && this.selectedOperationKeys.has(this.operationKey(row.operation))).length;
  }

  /** Re-resolve selection against current rows; stale/cancelled RH sends cannot be submitted. */
  updateTreatment(treated: boolean, operation?: ExportOperation): void {
    if (!this.canExport() || this.treatmentPending) return;
    const rows = this.periodExportRows().filter(row => operation
      ? this.operationKey(row.operation) === this.operationKey(operation) && Boolean(row.operation.treatedAt)
      : !row.operation.treatedAt && this.selectedOperationKeys.has(this.operationKey(row.operation)));
    if (!rows.length) return;
    this.store.dispatch(SettingsActions.rhTreatmentRequested({
      operations: rows.map(row => ({ type: row.templateId, id: row.operation.sourceId })), treated,
    }));
    this.selectedOperationKeys.clear();
  }
  readonly labels = APP_LABELS;
  readonly trackExportOperation = (_index: number, operation: ExportOperation): string => `${operation.sourceCollection}:${operation.sourceId}`;
  readonly templates: Array<{ id: ExportTemplateId; label: string }> = [
    { id: "regular", label: APP_LABELS.rh.exports.sections.regular },
    { id: "exceptionalOnCall", label: APP_LABELS.rh.exports.sections.exceptionalOnCall },
    { id: "exceptionalWork", label: APP_LABELS.exceptional.types.travaux },
  ];

  private readonly selectedMonthState = signal(this.toMonthKey(new Date()));
  set selectedMonth(value: string) { this.selectedMonthState.set(value); }
  get selectedMonth(): string { return this.selectedMonthState(); }
  private readonly exportMessageState = signal("");
  get exportMessage(): string { return this.exportMessageState(); }
  set exportMessage(value: string) { this.exportMessageState.set(value); }
  private readonly regularPeriodsState = signal<RhRegularPeriod[]>([]);
  set regularPeriods(value: RhRegularPeriod[]) { this.regularPeriodsState.set(value); }
  get regularPeriods(): RhRegularPeriod[] { return this.regularPeriodsState(); }
  private readonly regularInterventionsState = signal<RegularInterventionExport[]>([]);
  set regularInterventions(value: RegularInterventionExport[]) { this.regularInterventionsState.set(value); }
  get regularInterventions(): RegularInterventionExport[] { return this.regularInterventionsState(); }
  private readonly exceptionalOperationsState = signal<RhExceptionalOperation[]>([]);
  set exceptionalOperations(value: RhExceptionalOperation[]) { this.exceptionalOperationsState.set(value); }
  get exceptionalOperations(): RhExceptionalOperation[] { return this.exceptionalOperationsState(); }
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

  // NgRx owns domain data; these local computed views cache only presentation work.
  // Stable arrays prevent PrimeNG controls from being recreated during change detection.
  private readonly exportProfiles = computed(() => {
    const profiles = this.settingsState()?.users ?? [];
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    for (const profile of profiles) if (profile.uid) byId.set(profile.uid, profile);
    return byId;
  });

  private exportUserLabel(id: string | undefined, name = "", email = ""): string {
    const profile = id ? this.exportProfiles().get(id) : undefined;
    return formatRhExportUser(profile?.trigram, profile?.displayName || name, profile?.email || email);
  }

  private readonly normalizedOperations = computed<RhPeriodExportOperations>(() => ({
    regular: this.buildOperationsForTemplate("regular"),
    exceptionalOnCall: this.buildOperationsForTemplate("exceptionalOnCall"),
    exceptionalWork: this.buildOperationsForTemplate("exceptionalWork"),
  }));
  private readonly selectedPeriodOperations = computed(() => selectRhPeriodOperations(this.normalizedOperations(), this.exportPeriod));
  private readonly periodRows = computed(() => {
    const selected = this.selectedPeriodOperations();
    return this.templates.flatMap(template => selected[template.id].map(operation => ({
      templateId: template.id, typeLabel: this.periodLabels.sheets[template.id], operation,
      periodLabel: formatRange(operation.forecastStartDate, operation.forecastEndDate),
      startDate: new Date(operation.forecastStartDate),
      sentDate: operation.sentToRhAt ? new Date(operation.sentToRhAt) : null,
      treatedDate: operation.treatedAt ? new Date(operation.treatedAt) : null,
    })));
  });
  readonly trackPeriodOperation = (_index: number, row: { operation: ExportOperation }): string => this.operationKey(row.operation);
  private readonly visibleExportOperations = computed<RhPeriodExportOperations>(() => {
    const select = (template: ExportTemplateId) => this.operationsForTemplate(template, !this.userMode)
      .filter(operation => Boolean(operation.sentToRhAt) && (!this.userMode || Boolean(this.selectedUserId
        && this.operationUsers(operation).some(user => user.userId === this.selectedUserId))));
    return { regular: select("regular"), exceptionalOnCall: select("exceptionalOnCall"), exceptionalWork: select("exceptionalWork") };
  });
  private readonly exportUserOptions = computed(() => this.buildExportUsers());

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

  /** Capture the requested operation; recheck live submission and rights after async generation. */
  async exportExcelOperation(templateId: ExportTemplateId, operation: ExportOperation): Promise<void> {
    if (!this.canExport() || this.exportingOperationKey) return;
    const current = this.exportRows(templateId).find(row => row.sourceId === operation.sourceId
      && row.sourceCollection === operation.sourceCollection);
    if (!current) return;
    const filename = `${this.slug(current.title)}_${this.userMode ? current.forecastStartDate.slice(0, 10) : this.selectedMonth}.xlsx`;
    this.exportMessage = "";
    this.exportingOperationKey = this.operationKey(current);
    try {
      const data = await this.excelExportLibrary.buildWorkbook(templateId, current, this.exportContext());
      if (!this.canExport() || !this.exportRows(templateId).some(row => this.operationKey(row) === this.operationKey(current))) return;
      this.downloadBlob(filename, new Blob([new Uint8Array(data)], { type: RH_EXCEL_MIME }));
      this.exportMessage = this.formatMessage(this.labels.rh.exports.messages.excelGenerated, current.title);
    } catch {
      this.exportMessage = this.labels.rh.exports.messages.excelFailed;
    } finally {
      this.exportingOperationKey = null;
    }
  }

  exportRows(templateId: ExportTemplateId): ExportOperation[] {
    return this.visibleExportOperations()[templateId];
  }

  /** Historical participants remain selectable even after leaving the company. */
  get exportUsers(): Array<{ id: string; label: string }> { return this.exportUserOptions(); }

  private buildExportUsers(): Array<{ id: string; label: string }> {
    const users = new Map<string, string>();
    for (const template of this.templates) {
      for (const operation of this.operationsForTemplate(template.id, false)) {
        if (!operation.sentToRhAt) continue;
        for (const user of this.operationUsers(operation)) {
          if (user.userId) users.set(user.userId, user.name || user.userId);
        }
      }
    }
    return Array.from(users, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  private operationUsers(operation: ExportOperation): Array<{ userId?: string; name: string }> {
    return [...operation.plannedUsers, ...operation.actualUsers,
      ...operation.interventions.map(user => ({ userId: user.userId, name: user.userName }))];
  }

  get exportPeriod(): RhExportPeriod {
    return { startDate: this.periodStart, endDate: this.periodEnd };
  }

  get validExportPeriod(): boolean { return isValidRhExportPeriod(this.exportPeriod); }

  /** Uses all loaded operations: execution month must not limit submission-based exports. */
  periodOperations(): RhPeriodExportOperations {
    return this.normalizedOperations();
  }

  /** Preview uses the workbook selection rule so submission dates and cancellations stay consistent. */
  periodExportRows(): PeriodExportRow[] {
    return this.periodRows();
  }

  periodOperationCount(templateId: ExportTemplateId): number {
    return this.selectedPeriodOperations()[templateId].length;
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
    const operations = this.normalizedOperations()[templateId];
    if (!filterExecutionMonth) return operations;
    if (templateId === "regular") return operations.filter(operation => this.overlapsSelectedMonth(operation.forecastStartDate, operation.forecastEndDate));
    // Preserve the existing fallback to actual end dates when forecast end is absent.
    const matchingIds = new Set(this.exceptionalOperations.filter(operation => this.overlapsSelectedMonth(
      operation.startDate, operation.forecastEndDate || operation.actualEndDate || operation.startDate,
    )).map(operation => operation.id));
    return operations.filter(operation => matchingIds.has(operation.sourceId));
  }

  private buildOperationsForTemplate(templateId: ExportTemplateId): ExportOperation[] {
    if (templateId === "regular") {
      const byPeriod = new Map<string, RegularInterventionExport[]>();
      for (const intervention of this.regularInterventions) {
        const rows = byPeriod.get(intervention.periodId) ?? [];
        rows.push(intervention);
        byPeriod.set(intervention.periodId, rows);
      }
      return [...this.regularPeriods]
        .sort((first, second) => first.startDate.localeCompare(second.startDate))
        .map((period) => {
          const interventions = (byPeriod.get(period.id) ?? [])
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
            plannedUsers: [{ name: this.exportUserLabel(period.userId, period.userName, period.userEmail), startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa(), userId: period.userId }],
            actualUsers: [{ name: this.exportUserLabel(period.userId, period.userName, period.userEmail), startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa(), userId: period.userId }],
            interventions: interventions.map((intervention) => ({
              userId: intervention.userId,
              userName: this.exportUserLabel(intervention.userId, intervention.userName, intervention.userEmail),
              startDate: intervention.startDate,
              endDate: intervention.endDate,
              wasOnSite: false,
              comment: intervention.comment || "",
              visa: intervention.agentVisa || createEmptyVisa(),
            })),
            initiatorVisa: createEmptyVisa(),
            directorVisa: period.directorVisa || createEmptyVisa(),
            treatedAt: period.treatedAt,
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
            name: this.exportUserLabel(user.userId, user.displayName, user.email),
            startDate: user.startDate || forecastStart,
            endDate: user.endDate || forecastEnd,
            visa: user.visa || createEmptyVisa(),
            userId: user.userId,
          })),
          actualUsers: (operation.actualUsers || []).map((user) => ({
            name: this.exportUserLabel(user.userId, user.displayName, user.email),
            startDate: user.startDate || actualStart,
            endDate: user.endDate || actualEnd,
            visa: user.visa || createEmptyVisa(),
            userId: user.userId,
          })),
          interventions: (operation.interventions || []).map((intervention) => ({
            userId: intervention.userId,
            userName: this.exportUserLabel(intervention.userId, intervention.userName, intervention.userEmail),
            startDate: intervention.startDate || intervention.date || "",
            endDate: intervention.endDate || "",
            wasOnSite: Boolean(intervention.wasOnSite),
            comment: intervention.comment || intervention.label || "",
            visa: intervention.agentVisa || createEmptyVisa(),
          })),
          initiatorVisa: operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || operation.visas?.plannedInitiator || createEmptyVisa(),
          directorVisa: operation.visas?.directorGlobal || operation.visas?.actualDirector || operation.visas?.plannedDirector || createEmptyVisa(),
          treatedAt: operation.treatedAt,
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
