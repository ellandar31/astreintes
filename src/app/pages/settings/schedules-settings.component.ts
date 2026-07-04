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
  styleUrls: ['./schedules-settings.component.scss']
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
    hnoStart: "18:00",
    hnoEnd: "08:00",
    standbyPrime: 0,
    interventionPrime: 0,
  };
  
  scheduleByDay: Record<string, Omit<ScheduleRule, "id">> = {};

  constructor() {
    this.initializeScheduleByDay();
  }

  private readonly unsubscribe: Unsubscribe = onSnapshot(
    collection(db, "scheduleRules"),
    (snapshot) => {
      this.schedules = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as ScheduleRule)
        .sort((first, second) => this.days.indexOf(first.day) - this.days.indexOf(second.day));
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
      hnoStart: schedule.hnoStart,
      hnoEnd: schedule.hnoEnd,
      standbyPrime: schedule.standbyPrime,
      interventionPrime: schedule.interventionPrime,
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
          hnoStart: "18:00",
          hnoEnd: "08:00",
          standbyPrime: 0,
          interventionPrime: 0,
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
      standbyPrime: Number(this.scheduleForm.standbyPrime) || 0,
      interventionPrime: Number(this.scheduleForm.interventionPrime) || 0,
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
      hnoStart: "18:00",
      hnoEnd: "08:00",
      standbyPrime: 0,
      interventionPrime: 0,
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
          hnoStart: schedule.hnoStart,
          hnoEnd: schedule.hnoEnd,
          standbyPrime: Number(schedule.standbyPrime) || 0,
          interventionPrime: Number(schedule.interventionPrime) || 0,
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
