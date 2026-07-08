import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseStore, StoreUnsubscribe } from "../../store/firebase.store";
import { ScheduleDay, ScheduleRule } from "./settings.models";

@Component({
  selector: "app-schedules-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./schedules-settings.component.html",
  styleUrls: ["./settings-common.scss", "./schedules-settings.component.scss"],
})
export class SchedulesSettingsComponent implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly days: ScheduleDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche", "Jour férié"];

  editingScheduleId: string | null = null;
  schedules: ScheduleRule[] = [];
  scheduleForm = {
    day: "Lundi" as ScheduleDay,
    hoStart: "08:00",
    hoEnd: "18:00",
    hnoStart: "18:00",
    hnoEnd: "08:00",
    standbyPrime: 0,
    interventionPrime: 0,
  };
  scheduleByDay: Record<string, Omit<ScheduleRule, "id">> = {};

  private readonly unsubscribe: StoreUnsubscribe;

  constructor(private readonly firebaseStore: FirebaseStore) {
    this.initializeScheduleByDay();
    this.unsubscribe = this.firebaseStore.watchCollection<ScheduleRule>(
      "scheduleRules",
      (schedules) => {
        this.schedules = schedules.sort((first, second) => this.days.indexOf(first.day) - this.days.indexOf(second.day));
      },
      (error) => this.emitError(error),
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  editSchedule(schedule: ScheduleRule): void {
    this.editingScheduleId = schedule.id;
    this.scheduleForm = {
      day: schedule.day,
      hoStart: schedule.hoStart,
      hoEnd: schedule.hoEnd,
      hnoStart: schedule.hnoStart,
      hnoEnd: schedule.hnoEnd,
      standbyPrime: schedule.standbyPrime,
      interventionPrime: schedule.interventionPrime,
    };
  }

  async saveSchedule(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    const payload = {
      ...this.scheduleForm,
      standbyPrime: Number(this.scheduleForm.standbyPrime) || 0,
      interventionPrime: Number(this.scheduleForm.interventionPrime) || 0,
    };

    try {
      if (this.editingScheduleId) {
        await this.firebaseStore.setDocument("scheduleRules", this.editingScheduleId, payload);
      } else {
        await this.firebaseStore.addDocument("scheduleRules", payload);
      }

      this.resetScheduleForm(form);
      this.success.emit("Horaire enregistré.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteSchedule(schedule: ScheduleRule): Promise<void> {
    try {
      await this.firebaseStore.deleteDocument("scheduleRules", schedule.id);
      this.success.emit("Horaire supprimé.");
    } catch (error) {
      this.emitError(error);
    }
  }

  resetScheduleForm(form?: NgForm): void {
    this.editingScheduleId = null;
    this.scheduleForm = {
      day: "Lundi",
      hoStart: "08:00",
      hoEnd: "18:00",
      hnoStart: "18:00",
      hnoEnd: "08:00",
      standbyPrime: 0,
      interventionPrime: 0,
    };
    form?.resetForm(this.scheduleForm);
  }

  async saveAllSchedules(): Promise<void> {
    try {
      const operations = this.days.map((day) => {
        const schedule = this.scheduleByDay[day];

        const payload = {
          day,
          hoStart: schedule.hoStart,
          hoEnd: schedule.hoEnd,
          hnoStart: schedule.hnoStart,
          hnoEnd: schedule.hnoEnd,
          standbyPrime: Number(schedule.standbyPrime) || 0,
          interventionPrime: Number(schedule.interventionPrime) || 0,
        };

        return this.firebaseStore.setDocument("scheduleRules", day, payload);
      });

      await Promise.all(operations);

      this.success.emit("Horaires enregistrés.");
    } catch (error) {
      this.emitError(error);
    }
  }

  private initializeScheduleByDay(): void {
    this.scheduleByDay = Object.fromEntries(
      this.days.map((day) => [
        day,
        {
          day,
          hoStart: "08:00",
          hoEnd: "18:00",
          hnoStart: "18:00",
          hnoEnd: "08:00",
          standbyPrime: 0,
          interventionPrime: 0,
        },
      ]),
    );
  }

  private emitError(error: unknown): void {
    this.error.emit(this.firebaseStore.firebaseErrorMessage(error, "Erreur pendant l'enregistrement de l'horaire."));
  }
}
