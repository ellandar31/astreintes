import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseError } from "firebase/app";
import { Unsubscribe, addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { ScheduleDay, ScheduleRule, } from "./settings.models";

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

  readonly days: ScheduleDay[] = [
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
    "Dimanche",
    "Jour férié",
  ];

  editingScheduleId: string | null = null;
  schedules: ScheduleRule[] = [];
  scheduleForm = {
    day: "Lundi" as ScheduleDay,
    hoStart: "08:00",
    hoEnd: "18:00",
  };
  
  scheduleByDay: Record<string, Omit<ScheduleRule, "id">> = {};

  constructor() {
    this.initializeScheduleByDay();
  }

  private readonly unsubscribe: Unsubscribe = onSnapshot(
    collection(db, "scheduleRules"),
    (snapshot) => {
      this.initializeScheduleByDay();

      this.schedules = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as ScheduleRule)
        .sort((first, second) => this.days.indexOf(first.day) - this.days.indexOf(second.day));

      for (const schedule of this.schedules) {
        this.scheduleByDay[schedule.day] = {
          day: schedule.day,
          hoStart: schedule.hoStart || "08:00",
          hoEnd: schedule.hoEnd || "18:00",
        };
      }
    },
    (error) => this.emitError(error),
  );

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  editSchedule(schedule: ScheduleRule): void {
    this.editingScheduleId = schedule.id;
    this.scheduleForm = {
      day: schedule.day,
      hoStart: schedule.hoStart,
      hoEnd: schedule.hoEnd,
    };
  }

  private initializeScheduleByDay(): void {
    this.scheduleByDay = Object.fromEntries(
      this.days.map((day) => [
        day,
        {
          day,
          hoStart: "08:00",
          hoEnd: "18:00",
        },
      ]),
    );
  }

  async saveSchedule(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    const payload = {
      ...this.scheduleForm,
    };

    try {
      if (this.editingScheduleId) {
        await setDoc(doc(db, "scheduleRules", this.editingScheduleId), payload);
      } else {
        await addDoc(collection(db, "scheduleRules"), payload);
      }

      this.resetScheduleForm(form);
      this.success.emit("Horaire enregistré.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteSchedule(schedule: ScheduleRule): Promise<void> {
    try {
      await deleteDoc(doc(db, "scheduleRules", schedule.id));
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
    };
    form?.resetForm(this.scheduleForm);
  }

  private emitError(error: unknown): void {
    this.error.emit(
      error instanceof FirebaseError
        ? `Erreur Firebase (${error.code}) : ${error.message}`
        : "Erreur pendant l'enregistrement de l'horaire.",
    );
  }

  async saveAllSchedules(): Promise<void> {
    try {
      const operations = this.days.map((day) => {
        const schedule = this.scheduleByDay[day];
  
        const payload = {
          day,
          hoStart: schedule.hoStart,
          hoEnd: schedule.hoEnd,
        };
  
        return setDoc(doc(db, "scheduleRules", day), payload);
      });
  
      await Promise.all(operations);
  
      this.success.emit("Horaires enregistrés.");
    } catch (error) {
      this.emitError(error);
    }
  }
}
