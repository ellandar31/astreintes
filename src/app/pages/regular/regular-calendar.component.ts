import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { createEmptyVisa } from "../../shared/visa.models";
import { StoreUnsubscribe, appStore } from "../../store/app-store";
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

  private readonly unsubscribes: StoreUnsubscribe[] = [
    appStore.data.observeCollection<Record<string, unknown>>(appStore.paths.teams(), (documents) => {
      this.teams = documents
        .map((document) => {
          const data = document.data;
          return {
            id: document.id,
            name: String(data["name"] || ""),
            members: Array.isArray(data["members"]) ? data["members"].map(String) : [],
          };
        })
        .sort((first, second) => first.name.localeCompare(second.name));

      if (!this.selectedTeamId && this.teams.length) {
        this.selectedTeamId = this.teams[0].id;
      }
    }),
    appStore.data.observeCollection<RegularUser>(appStore.paths.users(), (documents) => {
      this.users = documents
        .map((document) => ({ ...document.data, id: document.id }) as RegularUser)
        .filter((user) => Boolean(user.email))
        .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
    }),
    appStore.data.observeCollection<RegularOnCallPeriod>(appStore.paths.regularOnCallPeriods(), (documents) => {
      this.periods = documents.map((document) => ({ ...document.data, id: document.id }) as RegularOnCallPeriod);
    }),
    appStore.data.observeCollection<RegularIntervention>(
      appStore.paths.regularInterventionsGroup(),
      (documents) => {
        this.interventions = documents.map((document) => {
          const data = document.data;
          const periodId = document.parentId || String(data["periodId"] || "");
          return { ...data, id: document.id, periodId } as RegularIntervention;
        });
      },
      (error) => {
        this.interventionError = this.toErrorMessage(error, "Impossible de charger les interventions.");
      },
    ),
    appStore.data.observeCollection<Record<string, unknown>>(appStore.paths.publicHolidays(), (documents) => {
      this.publicHolidays = documents
        .map((document) => {
          const data = document.data;
          return {
            id: document.id,
            date: String(data["date"] || ""),
            label: String(data["label"] || "Jour ferie"),
          };
        })
        .filter((holiday) => Boolean(holiday.date));
    }),
  ];

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
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

  async savePeriod(form: RegularOnCallPeriodForm): Promise<void> {
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

    if (this.editingPeriodId) {
      await appStore.data.updateDocument(appStore.paths.regularOnCallPeriod(this.editingPeriodId), {
        ...form,
        teamId: this.selectedTeamId,
        agentVisa: this.periods.find((period) => period.id === this.editingPeriodId)?.agentVisa || createEmptyVisa(),
        directorVisa: this.periods.find((period) => period.id === this.editingPeriodId)?.directorVisa || createEmptyVisa(),
        updatedAt: appStore.data.serverTimestamp(),
      });

      this.closePeriodModal();
      return;
    }

    await appStore.data.addDocument(appStore.paths.regularOnCallPeriods(), {
      ...form,
      teamId: this.selectedTeamId,
      agentVisa: createEmptyVisa(),
      directorVisa: createEmptyVisa(),
      createdAt: appStore.data.serverTimestamp(),
      updatedAt: appStore.data.serverTimestamp(),
    });

    this.closePeriodModal();
  }

  async saveIntervention(form: RegularInterventionForm): Promise<void> {
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

    try {
      const payload = {
        ...form,
        comment: form.comment.trim(),
        periodId: parentPeriod.id,
        teamId: parentPeriod.teamId,
        agentVisa: this.interventions.find((intervention) => intervention.id === this.editingInterventionId)?.agentVisa || createEmptyVisa(),
        updatedAt: appStore.data.serverTimestamp(),
      };

      if (this.editingInterventionId) {
        await appStore.data.updateDocument(appStore.paths.regularIntervention(parentPeriod.id, this.editingInterventionId), payload);
      } else {
        await appStore.data.addDocument(appStore.paths.regularInterventions(parentPeriod.id), {
          ...payload,
          createdAt: appStore.data.serverTimestamp(),
        });
      }

      this.closeInterventionModal();
    } catch (error) {
      this.interventionError = this.toErrorMessage(error, "Impossible d'enregistrer l'intervention.");
    }
  }

  async deleteIntervention(intervention: RegularIntervention): Promise<void> {
    if (this.isPeriodSentToRh(this.periodForIntervention(intervention))) {
      return;
    }

    const shouldDelete = window.confirm("Supprimer cette intervention ?");

    if (!shouldDelete) {
      return;
    }

    try {
      await appStore.data.deleteDocument(appStore.paths.regularIntervention(intervention.periodId, intervention.id));
    } catch (error) {
      this.interventionError = this.toErrorMessage(error, "Impossible de supprimer l'intervention.");
      this.isInterventionModalOpen = true;
    }
  }

  async deletePeriod(): Promise<void> {
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

    await Promise.all(
      this.interventions
        .filter((intervention) => intervention.periodId === this.editingPeriodId)
        .map((intervention) => appStore.data.deleteDocument(appStore.paths.regularIntervention(intervention.periodId, intervention.id))),
    );
    await appStore.data.deleteDocument(appStore.paths.regularOnCallPeriod(this.editingPeriodId));
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

  private toErrorMessage(error: unknown, fallback: string): string {
    if (appStore.errors.isError(error)) {
      if (error.code === "permission-denied") {
        return `${fallback} Les règles ne permettent pas encore cette opération.`;
      }

      return `${fallback} Erreur de la base (${error.code}) : ${error.message}`;
    }

    return fallback;
  }
}
