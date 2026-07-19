import { CommonModule } from "@angular/common";
import { Component, OnDestroy, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { createEmptyVisa } from "../../shared/visa.models";
import { Store } from "@ngrx/store";
import { RegularActions } from "../../state/regular/regular.actions";
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

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}

@Component({
  selector: "app-regular-calendar",
  standalone: true,
  imports: [CommonModule, FormsModule, RegularInterventionModalComponent, RegularPeriodModalComponent],
  templateUrl: "./regular-calendar.component.html",
  styleUrl: "./regular-calendar.component.css",
})
export class RegularCalendarComponent implements OnDestroy {
  readonly weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
  periods: RegularOnCallPeriod[] = [];
  publicHolidays: RegularPublicHoliday[] = [];
  selectedTeamId = "";
  teams: RegularTeam[] = [];
  users: RegularUser[] = [];

  private readonly store = inject(Store);
  private readonly regularError = this.store.selectSignal(selectRegularError);
  private readonly regularInterventions = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriods = this.store.selectSignal(selectRegularPeriods);
  private readonly regularPublicHolidays = this.store.selectSignal(selectRegularPublicHolidays);
  private readonly regularTeams = this.store.selectSignal(selectRegularTeams);
  private readonly regularUsers = this.store.selectSignal(selectRegularUsers);

  constructor() {
    this.store.dispatch(RegularActions.watchStarted());

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
      this.periods = this.regularPeriods();
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

  get monthLabel(): string {
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(this.currentMonth);
  }

  get calendarDays(): CalendarDay[] {
    const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        dateKey: this.toDateKey(date),
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === this.currentMonth.getMonth(),
      };
    });
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

  previousMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
  }

  openPeriodModal(): void {
    this.editingPeriodId = null;
    this.periodForm = this.createEmptyPeriodForm();
    this.isPeriodModalOpen = true;
  }

  openEditPeriodModal(period: RegularOnCallPeriod): void {
    this.editingPeriodId = period.id;
    this.periodForm = {
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

  openInterventionForCurrentPeriod(): void {
    const currentPeriod = this.periods.find((period) => period.id === this.editingPeriodId);

    if (!currentPeriod) {
      this.interventionError = "Impossible d'ajouter une intervention : l'astreinte doit être enregistrée avant.";
      return;
    }

    if (this.isPeriodSentToRh(currentPeriod)) {
      this.interventionError = "Cette astreinte a été envoyée aux RH et ne peut plus être modifiée.";
      return;
    }

    this.editingInterventionId = null;
    this.interventionPeriodId = currentPeriod.id;
    this.interventionError = "";
    this.interventionForm = this.createInterventionFormForPeriod(currentPeriod);
    this.isInterventionModalOpen = true;
  }

  openEditInterventionModal(intervention: RegularIntervention): void {
    const parentPeriod = this.periodForIntervention(intervention);

    if (this.isPeriodSentToRh(parentPeriod)) {
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
    };
    this.isInterventionModalOpen = true;
  }

  closeInterventionModal(): void {
    this.isInterventionModalOpen = false;
    this.editingInterventionId = null;
    this.interventionPeriodId = null;
    this.interventionError = "";
  }

  savePeriod(form: RegularOnCallPeriodForm): void {
    if (!this.selectedTeamId) {
      return;
    }

    const currentPeriod = this.editingPeriodId ? this.periods.find((period) => period.id === this.editingPeriodId) : null;

    if (this.isPeriodSentToRh(currentPeriod)) {
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

  saveIntervention(form: RegularInterventionForm): void {
    this.interventionError = "";

    if (form.endDate <= form.startDate) {
      this.interventionError = "La date de fin doit être postérieure à la date de début.";
      return;
    }

    const parentPeriod = this.findInterventionPeriod(form);

    if (!parentPeriod) {
      this.interventionError =
        "L'intervention doit être entièrement comprise dans une période d'astreinte régulière existante pour cet utilisateur.";
      return;
    }

    if (this.isPeriodSentToRh(parentPeriod)) {
      this.interventionError = "Cette astreinte a été envoyée aux RH et ne peut plus être modifiée.";
      return;
    }

    const existingIntervention = this.editingInterventionId
      ? this.interventions.find((intervention) => intervention.id === this.editingInterventionId)
      : undefined;

    this.store.dispatch(RegularActions.interventionSaveRequested({
      editingInterventionId: this.editingInterventionId,
      existingIntervention,
      form,
      parentPeriod,
    }));
    this.closeInterventionModal();
  }

  deleteIntervention(intervention: RegularIntervention): void {
    if (this.isPeriodSentToRh(this.periodForIntervention(intervention))) {
      return;
    }

    const shouldDelete = window.confirm("Supprimer cette intervention ?");

    if (!shouldDelete) {
      return;
    }

    this.store.dispatch(RegularActions.interventionDeleteRequested({
      interventionId: intervention.id,
      periodId: intervention.periodId,
    }));
  }

  deletePeriod(): void {
    if (!this.editingPeriodId) {
      return;
    }

    const currentPeriod = this.periods.find((period) => period.id === this.editingPeriodId);

    if (this.isPeriodSentToRh(currentPeriod)) {
      return;
    }

    const shouldDelete = window.confirm("Supprimer cette période d'astreinte ?");

    if (!shouldDelete) {
      return;
    }

    this.store.dispatch(RegularActions.periodDeleteRequested({
      interventions: this.interventions
        .filter((intervention) => intervention.periodId === this.editingPeriodId)
        .map((intervention) => ({ id: intervention.id, periodId: intervention.periodId })),
      periodId: this.editingPeriodId,
    }));
    this.closePeriodModal();
  }

  periodsForDay(day: CalendarDay): RegularOnCallPeriod[] {
    return this.selectedTeamPeriods.filter(
      (period) => this.toDateOnly(period.startDate) <= day.dateKey && this.toDateOnly(period.endDate) >= day.dateKey,
    ).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  isPeriodStart(day: CalendarDay, period: RegularOnCallPeriod): boolean {
    return this.toDateOnly(period.startDate) === day.dateKey;
  }

  publicHolidayForDay(day: CalendarDay): RegularPublicHoliday | undefined {
    return this.publicHolidays.find((holiday) => holiday.date === day.dateKey);
  }

  userLabel(user: RegularUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  isPeriodSentToRh(period: RegularOnCallPeriod | null | undefined): boolean {
    return Boolean(period?.sentToRhAt);
  }

  getPeriodColor(period: RegularOnCallPeriod): number {
    let hash = 0;
  
    for (const c of period.id) {
      hash = Math.trunc(((hash << 5) - hash) + (c.codePointAt(0) || 0));
    }
  
    return Math.abs(hash);
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

  private validatePeriod(form: RegularOnCallPeriodForm): string {
    if (form.endDate <= form.startDate) {
      return "La date de fin de l'astreinte doit être postérieure à la date de début.";
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

    return "Cet utilisateur possède déjà une astreinte sur cette période, même si elle appartient à une autre équipe.";
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  private toDateOnly(value: string): string {
    return value.slice(0, 10);
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
