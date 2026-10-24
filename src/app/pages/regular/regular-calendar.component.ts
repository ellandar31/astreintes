import { SelectButtonModule } from "primeng/selectbutton";
import { SharedTableModule } from "../../shared/shared-table.module";
import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { isArchivedOperation } from "../../shared/operation-archive";
import { selectSettingsDirections } from "../../state/settings/settings.selectors";
import { CalendarComponent } from "../../shared/calendar/calendar.component";
import { CalendarEntry } from "../../shared/calendar/calendar.models";
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { createEmptyVisa } from "../../shared/visa.models";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { RegularActions } from "../../state/regular/regular.actions";
import { selectCanCreateOperations, selectCanEditPlanning, selectCurrentApplicationUser } from "../../state/settings/settings.selectors";
import {
  selectRegularError,
  selectRegularInterventions,
  selectRegularPeriods,
  selectRegularPublicHolidays,
  selectRegularTeams,
  selectRegularUsers,
} from "../../state/regular/regular.selectors";
import {
  RegularIntervention,
  RegularInterventionForm,
  RegularOnCallPeriod,
  RegularOnCallPeriodForm,
  RegularPublicHoliday,
  RegularTeam,
  RegularUser,
} from "./regular.models";
import { RegularInterventionModalComponent } from "./regular-intervention-modal.component";
import { RegularPeriodModalComponent } from "./regular-period-modal.component";

/**
 * Planning mensuel des astreintes régulières.
 *
 * Le calendrier partagé assure le rendu mensuel ; cette page conserve les règles
 * métier et les données partagées du store NgRx. Les règles critiques sont le non-recouvrement des
 * astreintes d'un même utilisateur et l'obligation de rattacher chaque
 * intervention à une période d'astreinte existante.
 */
@Component({
  selector: "app-regular-calendar",
  standalone: true,
  imports: [SelectButtonModule, SharedTableModule, TableColumnHeaderComponent, TableRowsPipe, CalendarComponent, ButtonModule, CommonModule, FormsModule, RegularInterventionModalComponent, RegularPeriodModalComponent, SelectModule],
  templateUrl: "./regular-calendar.component.html",
  styleUrl: "./regular-calendar.component.css",
})
export class RegularCalendarComponent implements OnDestroy {
  readonly labels = APP_LABELS;
  readonly viewMode = signal<"table" | "calendar">("calendar");
  readonly viewOptions = [
    { label: APP_LABELS.common.views.table, value: "table" },
    { label: APP_LABELS.common.views.calendar, value: "calendar" },
  ];
  /** The calendar retains archived context; the table lists active periods for the selected team. */
  readonly tablePeriods = computed(() => this.selectedTeamPeriods.filter(period => !isArchivedOperation(period)));
  readonly interventionCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const intervention of this.regularInterventions()) counts.set(intervention.periodId, (counts.get(intervention.periodId) ?? 0) + 1);
    return counts;
  });
  readonly periodTableFields = {
    tableUser: (row: RegularOnCallPeriod) => row.userName || row.userEmail,
    tableStartDate: (row: RegularOnCallPeriod) => tableDate(row.startDate),
    tableEndDate: (row: RegularOnCallPeriod) => tableDate(row.endDate),
    interventionCount: (row: RegularOnCallPeriod) => this.interventionCounts().get(row.id) ?? 0,
  };

  setViewMode(value: unknown): void {
    if (value === "table" || value === "calendar") this.viewMode.set(value);
  }


  editingInterventionId: string | null = null;
  interventionPeriodId: string | null = null;
  currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  editingPeriodId: string | null = null;
  interventionError = "";
  interventionForm = this.createEmptyInterventionForm();
  interventions: RegularIntervention[] = [];
  isInterventionModalOpen = false;
  isPeriodModalOpen = false;
  periodForm = this.createEmptyPeriodForm();
  private readonly periodRows = signal<RegularOnCallPeriod[]>([]);
  get periods(): RegularOnCallPeriod[] { return this.periodRows(); }
  set periods(value: RegularOnCallPeriod[]) { this.periodRows.set(value); }
  publicHolidays: RegularPublicHoliday[] = [];
  private readonly selectedTeam = signal("");
  get selectedTeamId(): string { return this.selectedTeam(); }
  set selectedTeamId(value: string) { this.selectedTeam.set(value); }
  readonly calendarEntries = computed<CalendarEntry[]>(() => this.selectedTeamPeriods.map(period => ({
    id: period.id, label: period.userName, startDate: period.startDate, endDate: period.endDate,
    disabled: this.isPeriodArchived(period),
  })));

  /** Resolve the current aggregate before opening; a stale rendered event never grants editing rights. */
  openCalendarEntry(entry: CalendarEntry): void {
    const period = this.periods.find(period => period.id === entry.id);
    if (period) this.openEditPeriodModal(period);
  }
  teams: RegularTeam[] = [];
  users: RegularUser[] = [];

  private readonly store = inject(Store);
  readonly directions = this.store.selectSignal(selectSettingsDirections);
  readonly canCreateOperations = this.store.selectSignal(selectCanCreateOperations);
  readonly canEditPlanning = this.store.selectSignal(selectCanEditPlanning);
  private readonly currentProfile = this.store.selectSignal(selectCurrentApplicationUser);

  /** The same owner check gates row actions and direct handler calls. */
  readonly canManageIntervention = (intervention: { userId: string }): boolean =>
    this.canEditPlanning() || Boolean(this.currentProfile()?.role === 1 && this.currentProfile()?.id === intervention.userId);

  get interventionUsers(): RegularUser[] {
    return this.sortedUsers.filter(user => this.canManageIntervention({ userId: user.id }));
  }
  private readonly regularError = this.store.selectSignal(selectRegularError);
  private readonly regularInterventions = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriods = this.store.selectSignal(selectRegularPeriods);
  private readonly regularPublicHolidays = this.store.selectSignal(selectRegularPublicHolidays);
  private readonly regularTeams = this.store.selectSignal(selectRegularTeams);
  private readonly regularUsers = this.store.selectSignal(selectRegularUsers);

  constructor() {
    this.store.dispatch(RegularActions.watchStarted());

    effect(() => {
      if (!this.canCreateOperations() && this.isPeriodModalOpen && !this.editingPeriodId) {
        this.closePeriodModal();
      }
    });

    effect(() => {
      this.teams = this.regularTeams();

      if (!this.selectedTeamId && this.teams.length) {
        this.selectedTeamId = this.teams[0].id;
      }
    });

    effect(() => {
      this.users = this.regularUsers();
    });

    effect(() => {
      // Archived periods remain visible for calendar continuity; all editing paths stay locked.
      this.periods = this.regularPeriods();
      if (this.editingPeriodId && !this.periods.some(period => period.id === this.editingPeriodId && !isArchivedOperation(period))) this.closePeriodModal();
      if (this.interventionPeriodId && !this.periods.some(period => period.id === this.interventionPeriodId && !isArchivedOperation(period))) this.closeInterventionModal();
    });

    effect(() => {
      this.interventions = this.regularInterventions();
    });

    effect(() => {
      this.publicHolidays = this.regularPublicHolidays();
    });

    effect(() => {
      const error = this.regularError();

      if (error) {
        this.interventionError = error;
      }
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(RegularActions.watchStopped());
  }

  get selectedTeamUsers(): RegularUser[] {
    const selectedTeam = this.teams.find((team) => team.id === this.selectedTeamId);

    if (!selectedTeam) {
      return [];
    }

    return this.users.filter((user) => selectedTeam.members.includes(user.id) || selectedTeam.members.includes(user.email));
  }

  get selectedTeamPeriods(): RegularOnCallPeriod[] {
    return this.periods.filter((period) => period.teamId === this.selectedTeamId);
  }

  get sortedUsers(): RegularUser[] {
    return [...this.users].sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
  }

  get editingPeriodInterventions(): RegularIntervention[] {
    if (!this.editingPeriodId) {
      return [];
    }

    return this.interventions
      .filter((intervention) => intervention.periodId === this.editingPeriodId)
      .sort((first, second) => first.startDate.localeCompare(second.startDate));
  }

  get editingPeriod(): RegularOnCallPeriod | undefined {
    return this.periods.find((period) => period.id === this.editingPeriodId);
  }

  openPeriodModal(): void {
    if (!this.canCreateOperations()) return;
    this.editingPeriodId = null;
    this.periodForm = { ...this.createEmptyPeriodForm(), directionId: this.currentProfile()?.directionId || "" };
    this.isPeriodModalOpen = true;
  }

  openEditPeriodModal(period: RegularOnCallPeriod): void {
    if (isArchivedOperation(period) || isArchivedOperation(this.periods.find(current => current.id === period.id) || period)) return;
    this.editingPeriodId = period.id;
    this.periodForm = {
      directionId: period.directionId || "",
      userId: period.userId,
      userName: period.userName,
      userEmail: period.userEmail,
      startDate: period.startDate,
      endDate: period.endDate,
    };
    this.isPeriodModalOpen = true;
  }

  closePeriodModal(): void {
    this.isPeriodModalOpen = false;
    this.editingPeriodId = null;
  }

  openInterventionModal(): void {
    this.editingInterventionId = null;
    this.interventionPeriodId = null;
    this.interventionError = "";
    this.interventionForm = this.createEmptyInterventionForm();
    this.isInterventionModalOpen = true;
  }

  /**
   * Prépare l'ajout d'une intervention depuis une astreinte ouverte.
   *
   * L'intervention hérite de l'utilisateur et de la période pour réduire les
   * erreurs de saisie, mais elle reste validée au moment de l'enregistrement.
   */
  openInterventionForCurrentPeriod(): void {
    const currentPeriod = this.periods.find((period) => period.id === this.editingPeriodId);

    if (!currentPeriod) {
      this.interventionError = this.labels.regular.errors.interventionRequiresSavedPeriod;
      return;
    }

    this.openInterventionForPeriod(currentPeriod);
  }

  /** Both table and modal actions resolve the saved period before applying the same ownership rules. */
  openInterventionForPeriod(period: RegularOnCallPeriod): void {
    const currentPeriod = this.periods.find(current => current.id === period.id);
    if (!currentPeriod) return;
    if (!this.canManageIntervention(currentPeriod)) return;
    if (this.isPeriodArchived(currentPeriod)) {
      this.interventionError = this.labels.regular.errors.lockedPeriod;
      return;
    }

    this.editingInterventionId = null;
    this.interventionPeriodId = currentPeriod.id;
    this.interventionError = "";
    this.interventionForm = this.createInterventionFormForPeriod(currentPeriod);
    this.isInterventionModalOpen = true;
  }

  openEditInterventionModal(intervention: RegularIntervention): void {
    if (!this.canManageIntervention(intervention)) return;
    const parentPeriod = this.periodForIntervention(intervention);

    if (this.isPeriodArchived(parentPeriod)) {
      return;
    }

    this.editingInterventionId = intervention.id;
    this.interventionPeriodId = intervention.periodId;
    this.interventionError = "";
    this.interventionForm = {
      userId: intervention.userId,
      userName: intervention.userName,
      userEmail: intervention.userEmail,
      startDate: intervention.startDate,
      endDate: intervention.endDate,
      comment: intervention.comment || "",
      ticket: intervention.ticket || "",
    };
    this.isInterventionModalOpen = true;
  }

  closeInterventionModal(): void {
    this.isInterventionModalOpen = false;
    this.editingInterventionId = null;
    this.interventionPeriodId = null;
    this.interventionError = "";
  }

  /**
   * Enregistre une période d'astreinte régulière.
   *
   * Une période envoyée aux RH devient consultable uniquement : la correction
   * doit passer par l'annulation explicite de l'envoi RH afin de garder une trace
   * claire du cycle de paie.
   */
  savePeriod(form: RegularOnCallPeriodForm): void {
    if (this.editingPeriodId ? !this.canEditPlanning() : !this.canCreateOperations()) return;
    if (!this.selectedTeamId) {
      return;
    }

    const currentPeriod = this.editingPeriodId ? this.periods.find((period) => period.id === this.editingPeriodId) : null;
    if (this.isPeriodArchived(currentPeriod)) {
      return;
    }

    const periodError = this.validatePeriod(form);

    if (periodError) {
      window.alert(periodError);
      return;
    }

    this.store.dispatch(RegularActions.periodSaveRequested({
      editingPeriodId: this.editingPeriodId,
      existingAgentVisa: currentPeriod?.agentVisa || createEmptyVisa(),
      existingDirectorVisa: currentPeriod?.directorVisa || createEmptyVisa(),
      form,
      selectedTeamId: this.selectedTeamId,
    }));
    this.closePeriodModal();
  }

  /**
   * Enregistre une intervention régulière en contrôlant son rattachement métier.
   *
   * Une intervention ne peut pas exister seule : elle doit être entièrement
   * comprise dans une période d'astreinte du même utilisateur, sinon le calcul RH
   * et les visas deviendraient ambigus.
   */
  saveIntervention(form: RegularInterventionForm): void {
    if (!this.canManageIntervention(form)) return;
    if (this.editingInterventionId && !this.interventions.some(item =>
      item.id === this.editingInterventionId && this.canManageIntervention(item))) return;
    this.interventionError = "";

    if (form.endDate <= form.startDate) {
      this.interventionError = this.labels.regular.errors.endAfterStart;
      return;
    }

    const parentPeriod = this.findInterventionPeriod(form);

    if (!parentPeriod) {
      this.interventionError = this.labels.regular.errors.interventionOutsidePeriod;
      return;
    }

    if (this.isPeriodArchived(parentPeriod)) {
      this.interventionError = this.labels.regular.errors.lockedPeriod;
      return;
    }

    if (!form.ticket?.trim()) {
      this.interventionError = this.labels.common.messages.ticketRequired;
      return;
    }

    const existingIntervention = this.editingInterventionId
      ? this.interventions.find((intervention) => intervention.id === this.editingInterventionId)
      : undefined;

    this.store.dispatch(RegularActions.interventionSaveRequested({
      editingInterventionId: this.editingInterventionId,
      existingIntervention,
      form: { ...form, ticket: form.ticket.trim() },
      parentPeriod,
    }));
    this.closeInterventionModal();
  }

  deleteIntervention(intervention: RegularIntervention): void {
    if (!this.canManageIntervention(intervention)) return;
    if (this.isPeriodArchived(this.periodForIntervention(intervention))) {
      return;
    }

    const shouldDelete = window.confirm(this.labels.regular.actions.deleteInterventionConfirm);

    if (!shouldDelete) {
      return;
    }

    this.store.dispatch(RegularActions.interventionDeleteRequested({
      interventionId: intervention.id,
      periodId: intervention.periodId,
    }));
  }

  /** Supprime l'astreinte et ses interventions rattachées pour éviter des interventions orphelines. */
  deletePeriod(periodId: string | null = this.editingPeriodId): void {
    if (!this.canEditPlanning()) return;
    if (!periodId) {
      return;
    }

    const currentPeriod = this.periods.find((period) => period.id === periodId);
    if (!currentPeriod || this.isPeriodArchived(currentPeriod)) {
      return;
    }

    const shouldDelete = window.confirm(this.labels.regular.actions.deletePeriodConfirm);

    if (!shouldDelete) {
      return;
    }

    this.store.dispatch(RegularActions.periodDeleteRequested({
      interventions: this.interventions
        .filter((intervention) => intervention.periodId === periodId)
        .map((intervention) => ({ id: intervention.id, periodId: intervention.periodId })),
      periodId,
    }));
    if (this.editingPeriodId === periodId) this.closePeriodModal();
  }

  userLabel(user: RegularUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  isPeriodArchived(period: RegularOnCallPeriod | null | undefined): boolean {
    return Boolean(period && isArchivedOperation(period));
  }

  private createEmptyPeriodForm(): RegularOnCallPeriodForm {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    return {
      userId: "",
      userName: "",
      userEmail: "",
      startDate: `${this.toDateKey(startDate)}T18:00`,
      endDate: `${this.toDateKey(endDate)}T08:00`,
    };
  }

  private createEmptyInterventionForm(): RegularInterventionForm {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);

    return {
      userId: "",
      userName: "",
      userEmail: "",
      startDate: this.toDateTimeLocal(startDate),
      endDate: this.toDateTimeLocal(endDate),
      comment: "",
      ticket: "",
    };
  }

  private createInterventionFormForPeriod(period: RegularOnCallPeriod): RegularInterventionForm {
    const startDate = period.startDate;
    const oneHourAfterStart = this.addHours(startDate, 1);
    const endDate = oneHourAfterStart < period.endDate ? oneHourAfterStart : period.endDate;

    return {
      userId: period.userId,
      userName: period.userName,
      userEmail: period.userEmail,
      startDate,
      endDate,
      comment: "",
      ticket: "",
    };
  }

  private findInterventionPeriod(form: RegularInterventionForm): RegularOnCallPeriod | undefined {
    if (this.interventionPeriodId) {
      const period = this.periods.find((item) => item.id === this.interventionPeriodId);

      if (period?.userId === form.userId && period.startDate <= form.startDate && period.endDate >= form.endDate) {
        return period;
      }

      return undefined;
    }

    return this.periods.find(
      (period) => period.userId === form.userId && period.startDate <= form.startDate && period.endDate >= form.endDate,
    );
  }

  private periodForIntervention(intervention: RegularIntervention): RegularOnCallPeriod | undefined {
    return this.periods.find((period) => period.id === intervention.periodId);
  }

  /**
   * Valide les contraintes de planning agent.
   *
   * Le non-recouvrement s'applique toutes équipes confondues : un agent ne peut
   * pas être d'astreinte en parallèle dans deux équipes différentes.
   */
  private validatePeriod(form: RegularOnCallPeriodForm): string {
    if (form.endDate <= form.startDate) {
      return this.labels.regular.errors.periodEndAfterStart;
    }

    const hasOverlappingPeriod = this.periods.some(
      (period) =>
        period.id !== this.editingPeriodId &&
        period.userId === form.userId &&
        this.dateRangesOverlap(form.startDate, form.endDate, period.startDate, period.endDate),
    );

    if (!hasOverlappingPeriod) {
      return "";
    }

    return this.labels.regular.errors.periodOverlap;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  private toDateTimeLocal(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${this.toDateKey(date)}T${hours}:${minutes}`;
  }

  private addHours(value: string, hoursToAdd: number): string {
    const date = new Date(value);
    date.setHours(date.getHours() + hoursToAdd);

    return this.toDateTimeLocal(date);
  }

  private dateRangesOverlap(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
    return firstStart < secondEnd && firstEnd > secondStart;
  }

}
