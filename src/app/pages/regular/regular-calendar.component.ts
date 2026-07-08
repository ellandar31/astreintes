import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FirebaseStore, StoreUnsubscribe } from "../../store/firebase.store";
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

  private readonly unsubscribes: StoreUnsubscribe[];

  constructor(private readonly firebaseStore: FirebaseStore) {
    this.unsubscribes = [
      this.firebaseStore.watchCollection<Record<string, unknown> & { id: string }>("teams", (teams) => {
        this.teams = teams
          .map((data) => {
          return {
            id: data.id,
            name: String(data["name"] || ""),
            members: Array.isArray(data["members"]) ? data["members"].map(String) : [],
          };
        })
        .sort((first, second) => first.name.localeCompare(second.name));

        if (!this.selectedTeamId && this.teams.length) {
          this.selectedTeamId = this.teams[0].id;
        }
      }),
      this.firebaseStore.watchCollection<RegularUser>("users", (users) => {
        this.users = users.filter((user) => Boolean(user.email)).sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
      }),
      this.firebaseStore.watchCollection<RegularOnCallPeriod>("regularOnCallPeriods", (periods) => {
        this.periods = periods;
      }),
      this.firebaseStore.watchCollection<RegularIntervention>(
        "regularInterventions",
        (interventions) => {
          this.interventions = interventions;
        },
        (error) => {
          this.interventionError = this.toFirebaseErrorMessage(error, "Impossible de charger les interventions.");
        },
      ),
      this.firebaseStore.watchCollection<Record<string, unknown> & { id: string }>("publicHolidays", (holidays) => {
        this.publicHolidays = holidays
          .map((data) => {
            return {
              id: data.id,
              date: String(data["date"] || ""),
              label: String(data["label"] || "Jour ferie"),
            };
          })
          .filter((holiday) => Boolean(holiday.date));
      }),
    ];
  }

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

    this.editingInterventionId = null;
    this.interventionPeriodId = currentPeriod.id;
    this.interventionError = "";
    this.interventionForm = this.createInterventionFormForPeriod(currentPeriod);
    this.isInterventionModalOpen = true;
  }

  openEditInterventionModal(intervention: RegularIntervention): void {
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

    const periodError = this.validatePeriod(form);

    if (periodError) {
      window.alert(periodError);
      return;
    }

    if (this.editingPeriodId) {
      await this.firebaseStore.updateDocument("regularOnCallPeriods", this.editingPeriodId, {
        ...form,
        teamId: this.selectedTeamId,
        updatedAt: this.firebaseStore.timestamp(),
      });

      this.closePeriodModal();
      return;
    }

    await this.firebaseStore.addDocument("regularOnCallPeriods", {
      ...form,
      teamId: this.selectedTeamId,
      createdAt: this.firebaseStore.timestamp(),
      updatedAt: this.firebaseStore.timestamp(),
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
        "Aucune astreinte régulière ne couvre cette intervention pour cet utilisateur. Créez d'abord la période d'astreinte correspondante.";
      return;
    }

    try {
      const payload = {
        ...form,
        comment: form.comment.trim(),
        periodId: parentPeriod.id,
        teamId: parentPeriod.teamId,
        updatedAt: this.firebaseStore.timestamp(),
      };

      if (this.editingInterventionId) {
        await this.firebaseStore.updateDocument("regularInterventions", this.editingInterventionId, payload);
      } else {
        await this.firebaseStore.addDocument("regularInterventions", {
          ...payload,
          createdAt: this.firebaseStore.timestamp(),
        });
      }

      this.closeInterventionModal();
    } catch (error) {
      this.interventionError = this.toFirebaseErrorMessage(error, "Impossible d'enregistrer l'intervention.");
    }
  }

  async deleteIntervention(intervention: RegularIntervention): Promise<void> {
    const shouldDelete = window.confirm("Supprimer cette intervention ?");

    if (!shouldDelete) {
      return;
    }

    try {
      await this.firebaseStore.deleteDocument("regularInterventions", intervention.id);
    } catch (error) {
      this.interventionError = this.toFirebaseErrorMessage(error, "Impossible de supprimer l'intervention.");
      this.isInterventionModalOpen = true;
    }
  }

  async deletePeriod(): Promise<void> {
    if (!this.editingPeriodId) {
      return;
    }

    const shouldDelete = window.confirm("Supprimer cette période d'astreinte ?");

    if (!shouldDelete) {
      return;
    }

    await this.firebaseStore.deleteDocument("regularOnCallPeriods", this.editingPeriodId);
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

  getPeriodColor(period: RegularOnCallPeriod): number {
    let hash = 0;
  
    for (const c of period.id) {
      hash = ((hash << 5) - hash) + c.charCodeAt(0);
      hash |= 0;
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

      if (period && period.userId === form.userId && period.startDate <= form.startDate && period.endDate >= form.endDate) {
        return period;
      }

      return undefined;
    }

    return this.periods.find(
      (period) => period.userId === form.userId && period.startDate <= form.startDate && period.endDate >= form.endDate,
    );
  }

  private validatePeriod(form: RegularOnCallPeriodForm): string {
    if (form.endDate <= form.startDate) {
      return "La date de fin de l'astreinte doit être postérieure à la date de début.";
    }

    const overlappingPeriod = this.periods.find(
      (period) =>
        period.id !== this.editingPeriodId &&
        period.userId === form.userId &&
        this.dateRangesOverlap(form.startDate, form.endDate, period.startDate, period.endDate),
    );

    if (!overlappingPeriod) {
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

  private toFirebaseErrorMessage(error: unknown, fallback: string): string {
    if (this.firebaseStore.isFirebaseError(error)) {
      if (error.code === "permission-denied") {
        return `${fallback} Les règles Firestore ne permettent pas encore cette opération.`;
      }

      return `${fallback} Erreur Firebase (${error.code}) : ${error.message}`;
    }

    return fallback;
  }
}
