import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges, effect, inject } from "@angular/core";
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
import { selectSettingsRhCompensation, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { StoreAuthUser } from "../../store/app-store";
import {
  ExportOperation,
  InterventionCompensationRow,
  OnCallCompensationRule,
  OnCallCompensationRow,
  PeriodCompensationRule,
  RhExportContext,
} from "./export-libraries/rh-export.models";
import { RhExportCalculationLibrary } from "./export-libraries/rh-export-calculations";
import { formatRange } from "./export-libraries/rh-export-utils";
import { RhControlDetailModalComponent } from "./rh-control-detail-modal.component";
import { RhControlDetailItem, RhControlDetailLine } from "./rh-control-detail.models";
import {
  RhExceptionalOperation,
  RhPublicHoliday,
  RhRegularPeriod,
  RhUser,
} from "./rh.models";

interface RhRegularIntervention {
  id: string;
  periodId: string;
  teamId: string;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment?: string;
  agentVisa?: SignatureVisa;
}

interface RhUserControlSection {
  user: RhUser;
  itemCount: number;
  monthSections: RhMonthControlSection[];
}

interface RhMonthControlSection {
  monthKey: string;
  monthLabel: string;
  items: RhControlDetailItem[];
}

@Component({
  selector: "app-rh-controls",
  standalone: true,
  imports: [CommonModule, RhControlDetailModalComponent],
  templateUrl: "./rh-controls.component.html",
  styleUrl: "./rh-controls.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RhControlsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) currentUser: StoreAuthUser | null = null;
  readonly labels = APP_LABELS;

  users: RhUser[] = [];
  regularPeriods: RhRegularPeriod[] = [];
  regularInterventions: RhRegularIntervention[] = [];
  publicHolidays: RhPublicHoliday[] = [];
  exceptionalOperations: RhExceptionalOperation[] = [];
  selectedDetailItem: RhControlDetailItem | null = null;
  expandedMonthSectionKey: string | null = null;
  expandedUserId: string | null = null;
  userSections: RhUserControlSection[] = [];

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

  private readonly store = inject(Store);
  private readonly exceptionalOperationsSignal = this.store.selectSignal(selectExceptionalOperations);
  private readonly regularInterventionsSignal = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriodsSignal = this.store.selectSignal(selectRegularPeriods);
  private readonly publicHolidaysSignal = this.store.selectSignal(selectRegularPublicHolidays);
  private readonly rhCompensationSignal = this.store.selectSignal(selectSettingsRhCompensation);
  private readonly usersSignal = this.store.selectSignal(selectSettingsUsers);

  constructor() {
    this.store.dispatch(SettingsActions.usersWatchStarted());
    this.store.dispatch(SettingsActions.rhCompensationWatchStarted());
    this.store.dispatch(RegularActions.watchStarted());
    this.store.dispatch(ExceptionalActions.watchStarted());

    effect(() => {
      this.users = [...this.usersSignal()]
        .filter((user) => Boolean(user.email))
        .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second))) as RhUser[];
      this.rebuildControlSections();
    });

    effect(() => {
      this.regularPeriods = this.regularPeriodsSignal() as RhRegularPeriod[];
      this.rebuildControlSections();
    });

    effect(() => {
      this.regularInterventions = this.regularInterventionsSignal() as RhRegularIntervention[];
      this.rebuildControlSections();
    });

    effect(() => {
      this.publicHolidays = this.publicHolidaysSignal() as RhPublicHoliday[];
      this.rebuildControlSections();
    });

    effect(() => {
      this.exceptionalOperations = this.exceptionalOperationsSignal() as RhExceptionalOperation[];
      this.rebuildControlSections();
    });

    effect(() => {
      const settings = this.rhCompensationSignal();

      if (!settings) {
        return;
      }

      this.onCallCompensationRules = this.mergeRows(this.onCallCompensationRules, settings.onCall);
      this.periodCompensationRules = this.mergeRows(this.periodCompensationRules, settings.periods);
      this.rebuildControlSections();
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(SettingsActions.usersWatchStopped());
    this.store.dispatch(SettingsActions.rhCompensationWatchStopped());
    this.store.dispatch(RegularActions.watchStopped());
    this.store.dispatch(ExceptionalActions.watchStopped());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["currentUser"]) {
      this.rebuildControlSections();
    }
  }

  private get currentProfile(): RhUser | undefined {
    return this.users.find((user) => this.isCurrentUser(user));
  }

  private get visibleUsers(): RhUser[] {
    const profile = this.currentProfile;

    if (!profile) {
      return this.users.filter((user) => this.isCurrentUser(user));
    }

    if (profile.role === 1) {
      return [profile];
    }

    return this.users;
  }

  toggleMonthSection(userId: string, monthKey: string): void {
    const sectionKey = this.monthSectionKey(userId, monthKey);
    this.expandedMonthSectionKey = this.expandedMonthSectionKey === sectionKey ? null : sectionKey;
  }

  isMonthExpanded(userId: string, monthKey: string): boolean {
    return this.expandedMonthSectionKey === this.monthSectionKey(userId, monthKey);
  }

  toggleUserSection(userId: string): void {
    if (this.expandedUserId === userId) {
      this.expandedUserId = null;
      this.expandedMonthSectionKey = null;
      return;
    }

    this.expandedUserId = userId;
    this.expandFirstMonthForUser(userId);
  }

  isUserExpanded(userId: string): boolean {
    return this.expandedUserId === userId;
  }

  openDetail(item: RhControlDetailItem): void {
    this.selectedDetailItem = item;
  }

  closeDetail(): void {
    this.selectedDetailItem = null;
  }

  userLabel(user: RhUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  }

  private rebuildControlSections(): void {
    const visibleUsers = this.visibleUsers;
    const calculator = new RhExportCalculationLibrary(this.exportContext());
    const regularInterventionsByPeriod = this.regularInterventionsByPeriod();
    const userItems = new Map<string, RhControlDetailItem[]>();
    const monthKeys = new Set<string>();

    visibleUsers.forEach((user) => {
      const items = this.allItemsForUser(user, calculator, regularInterventionsByPeriod);
      userItems.set(user.id, items);
      items.forEach((item) => {
        const monthKey = this.sentToRhMonthKey(item.sentToRhAt);

        if (monthKey) {
          monthKeys.add(monthKey);
        }
      });
    });

    const sortedMonthKeys = Array.from(monthKeys).sort((first, second) => second.localeCompare(first));

    this.userSections = visibleUsers
      .map((user) => {
        const items = userItems.get(user.id) || [];
        const monthSections = sortedMonthKeys
          .map((monthKey) => ({
            monthKey,
            monthLabel: this.formatMonth(monthKey),
            items: items.filter((item) => this.sentToRhMonthKey(item.sentToRhAt) === monthKey),
          }))
          .filter((section) => section.items.length > 0);

        return {
          user,
          itemCount: items.length,
          monthSections,
        };
      })
      .filter((section) => section.itemCount > 0 || this.isCurrentUser(section.user));

    this.syncSelectedDetailItem();
    this.ensureDefaultExpandedState();
  }

  private allItemsForUser(
    user: RhUser,
    calculator: RhExportCalculationLibrary,
    regularInterventionsByPeriod: Map<string, RhRegularIntervention[]>,
  ): RhControlDetailItem[] {
    return [
      ...this.regularControlItems(user, calculator, regularInterventionsByPeriod),
      ...this.exceptionalControlItems(user, calculator),
    ].sort((first, second) => this.sentToRhTime(second.sentToRhAt) - this.sentToRhTime(first.sentToRhAt));
  }

  private regularControlItems(
    user: RhUser,
    calculator: RhExportCalculationLibrary,
    regularInterventionsByPeriod: Map<string, RhRegularIntervention[]>,
  ): RhControlDetailItem[] {
    return this.regularPeriods
      .filter((period) => Boolean(period.sentToRhAt))
      .filter((period) => this.matchesUser(period.userId, period.userEmail, user))
      .map((period) => {
        const operation = this.regularExportOperation(period, regularInterventionsByPeriod.get(period.id) || []);
        const lines = [
          ...calculator.onCallCompensationRows(operation).map((row, index) => this.onCallLine(row, calculator, `regular-oncall-${index}`)),
          ...calculator.interventionCompensationRows(operation, false).map((row, index) =>
            this.interventionLine(row, calculator, `regular-intervention-${index}`, this.labels.rh.controls.types.intervention),
          ),
        ];

        return {
          id: `regular-${period.id}`,
          type: this.labels.rh.controls.types.regularOnCall,
          title: operation.title,
          sentToRhAt: period.sentToRhAt,
          sentToRhLabel: this.formatDateTime(period.sentToRhAt),
          period: formatRange(period.startDate, period.endDate),
          lines,
        };
      })
      .filter((item) => item.lines.length > 0);
  }

  private exceptionalControlItems(user: RhUser, calculator: RhExportCalculationLibrary): RhControlDetailItem[] {
    return this.exceptionalOperations
      .filter((operation) => Boolean(operation.sentToRhAt))
      .map((operation) => this.exceptionalExportOperationForUser(operation, user))
      .filter((operation): operation is ExportOperation => Boolean(operation))
      .map((operation) => {
        const isWork = operation.exportTitle === this.labels.rh.controls.types.exceptionalWork;
        const lines = [
          ...calculator.onCallCompensationRows(operation).map((row, index) => this.onCallLine(row, calculator, `exceptional-oncall-${index}`)),
          ...calculator.interventionCompensationRows(operation, isWork).map((row, index) =>
            this.interventionLine(
              row,
              calculator,
              `exceptional-intervention-${index}`,
              isWork ? this.labels.rh.controls.types.work : this.labels.rh.controls.types.intervention,
            ),
          ),
        ];

        return {
          id: `exceptional-${operation.sourceId}`,
          type: operation.exportTitle,
          title: operation.title,
          sentToRhAt: operation.sentToRhAt,
          sentToRhLabel: this.formatDateTime(operation.sentToRhAt),
          period: formatRange(operation.actualStartDate, operation.actualEndDate),
          lines,
        };
      })
      .filter((item) => item.lines.length > 0);
  }

  private regularExportOperation(period: RhRegularPeriod, periodInterventions: RhRegularIntervention[]): ExportOperation {
    const interventions = periodInterventions
      .filter((intervention) => this.matchesRegularPeriodUser(intervention, period))
      .sort((first, second) => first.startDate.localeCompare(second.startDate));
    const userName = period.userName || period.userEmail;

    return {
      sourceId: period.id,
      sourceCollection: "regularOnCallPeriods",
      title: `${this.labels.rh.controls.types.regularOnCall} - ${userName}`,
      exportTitle: this.labels.rh.controls.types.regularOnCallPlural,
      initiatorName: "",
      operationManagerName: "",
      forecastStartDate: period.startDate,
      forecastEndDate: period.endDate,
      actualStartDate: period.startDate,
      actualEndDate: period.endDate,
      plannedUsers: [{ name: userName, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
      actualUsers: [{ name: userName, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
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
      sentToRhAt: period.sentToRhAt as string | undefined,
    };
  }

  private exceptionalExportOperationForUser(operation: RhExceptionalOperation, user: RhUser): ExportOperation | null {
    const operationType = operation.type === "travaux"
      ? this.labels.rh.controls.types.exceptionalWork
      : this.labels.rh.controls.types.exceptionalOnCall;
    const forecastStart = operation.startDate || "";
    const forecastEnd = operation.forecastEndDate || operation.startDate || "";
    const actualStart = operation.actualStartDate || forecastStart;
    const actualEnd = operation.actualEndDate || forecastEnd;
    const actualUsers = (operation.actualUsers || [])
      .filter((participant) => this.matchesUser(participant.userId, participant.email, user))
      .map((participant) => ({
        name: participant.displayName || participant.email,
        startDate: participant.startDate || actualStart,
        endDate: participant.endDate || actualEnd,
        visa: participant.visa || createEmptyVisa(),
      }));
    const interventions = (operation.interventions || [])
      .filter((intervention) => this.matchesUser(intervention.userId, intervention.userEmail, user))
      .map((intervention) => ({
        userName: intervention.userName || intervention.userEmail,
        startDate: intervention.startDate || intervention.date || "",
        endDate: intervention.endDate || "",
        wasOnSite: Boolean(intervention.wasOnSite),
        comment: intervention.comment || intervention.label || "",
        visa: intervention.agentVisa || createEmptyVisa(),
      }));

    if (!actualUsers.length && !interventions.length) {
      return null;
    }

    return {
      sourceId: operation.id,
      sourceCollection: "exceptionalOperations",
      title: operation.title || operationType,
      exportTitle: operationType,
      initiatorName: operation.initiatorName || "",
      operationManagerName: operation.operationManagerName || "",
      forecastStartDate: forecastStart,
      forecastEndDate: forecastEnd,
      actualStartDate: actualStart,
      actualEndDate: actualEnd,
      plannedUsers: [],
      actualUsers,
      interventions,
      initiatorVisa: operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || operation.visas?.plannedInitiator || createEmptyVisa(),
      directorVisa: operation.visas?.directorGlobal || operation.visas?.actualDirector || operation.visas?.plannedDirector || createEmptyVisa(),
      sentToRhAt: operation.sentToRhAt as string | undefined,
    };
  }

  private onCallLine(row: OnCallCompensationRow, calculator: RhExportCalculationLibrary, id: string): RhControlDetailLine {
    return {
      id,
      nature: this.labels.rh.controls.types.onCall,
      label: row.label,
      period: formatRange(row.startDate, row.endDate),
      hours: row.hours,
      coefficient: row.coefficient,
      details: calculator.segmentDetails(row.segments),
    };
  }

  private interventionLine(row: InterventionCompensationRow, calculator: RhExportCalculationLibrary, id: string, nature: string): RhControlDetailLine {
    return {
      id,
      nature,
      label: row.label,
      period: formatRange(row.startDate, row.endDate),
      hours: row.hours,
      coefficient: row.coefficient,
      restCoefficient: row.restCoefficient,
      details: calculator.segmentDetails(row.segments),
    };
  }

  private exportContext(): RhExportContext {
    return {
      publicHolidays: this.publicHolidays,
      onCallCompensationRules: this.onCallCompensationRules,
      periodCompensationRules: this.periodCompensationRules,
    };
  }

  private matchesRegularPeriodUser(intervention: RhRegularIntervention, period: RhRegularPeriod): boolean {
    return intervention.userId === period.userId || Boolean(intervention.userEmail && intervention.userEmail === period.userEmail);
  }

  private matchesUser(userId: string | undefined, email: string | undefined, user: RhUser): boolean {
    return userId === user.id || Boolean(email && email === user.email);
  }

  private isCurrentUser(user: RhUser): boolean {
    return user.id === this.currentUser?.uid || Boolean(this.currentUser?.email && user.email === this.currentUser.email);
  }

  private ensureDefaultExpandedState(): void {
    if (this.expandedUserId && this.userSections.some((section) => section.user.id === this.expandedUserId)) {
      return;
    }

    const defaultSection = this.userSections.find((section) => this.isCurrentUser(section.user)) || this.userSections[0];

    if (defaultSection) {
      this.expandedUserId = defaultSection.user.id;
      this.expandFirstMonthForUser(defaultSection.user.id);
      return;
    }

    this.expandedUserId = null;
    this.expandedMonthSectionKey = null;
  }

  private expandFirstMonthForUser(userId: string): void {
    const firstMonth = this.userSections.find((section) => section.user.id === userId)?.monthSections[0]?.monthKey || "";
    this.expandedMonthSectionKey = firstMonth ? this.monthSectionKey(userId, firstMonth) : null;
  }

  private regularInterventionsByPeriod(): Map<string, RhRegularIntervention[]> {
    return this.regularInterventions.reduce((index, intervention) => {
      const interventions = index.get(intervention.periodId) || [];
      interventions.push(intervention);
      index.set(intervention.periodId, interventions);
      return index;
    }, new Map<string, RhRegularIntervention[]>());
  }

  private syncSelectedDetailItem(): void {
    if (!this.selectedDetailItem) {
      return;
    }

    this.selectedDetailItem =
      this.userSections.flatMap((section) => section.monthSections.flatMap((monthSection) => monthSection.items))
        .find((item) => item.id === this.selectedDetailItem?.id) || this.selectedDetailItem;
  }

  private monthSectionKey(userId: string, monthKey: string): string {
    return `${userId}::${monthKey}`;
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => {
      const savedRow = savedRows.find((row) => row.id === defaultRow.id);
      return savedRow ? { ...defaultRow, ...savedRow } : defaultRow;
    });
  }

  private formatDateTime(value: unknown): string {
    const date = this.toDate(value);
    return date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date) : "-";
  }

  private sentToRhTime(value: unknown): number {
    return this.toDate(value)?.getTime() || 0;
  }

  private sentToRhMonthKey(value: unknown): string {
    const date = this.toDate(value);

    if (!date) {
      return "";
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate();
    }

    if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
      const nanoseconds = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return new Date(value.seconds * 1000 + Math.floor(nanoseconds / 1000000));
    }

    return null;
  }
}
