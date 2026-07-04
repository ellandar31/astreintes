import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseError } from "firebase/app";
import { Unsubscribe, collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { PublicHoliday } from "./settings.models";

type HolidaySourceResponse = Record<string, string>;

@Component({
  selector: "app-holidays-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./holidays-settings.component.html",
})
export class HolidaysSettingsComponent implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly zones = [
    { id: "metropole", label: "Métropole" },
    { id: "alsace-moselle", label: "Alsace-Moselle" },
    { id: "guadeloupe", label: "Guadeloupe" },
    { id: "guyane", label: "Guyane" },
    { id: "la-reunion", label: "La Réunion" },
    { id: "martinique", label: "Martinique" },
    { id: "mayotte", label: "Mayotte" },
    { id: "nouvelle-caledonie", label: "Nouvelle-Calédonie" },
    { id: "polynesie-francaise", label: "Polynésie française" },
    { id: "saint-barthelemy", label: "Saint-Barthélemy" },
    { id: "saint-martin", label: "Saint-Martin" },
    { id: "saint-pierre-et-miquelon", label: "Saint-Pierre-et-Miquelon" },
    { id: "wallis-et-futuna", label: "Wallis-et-Futuna" },
  ];

  holidays: PublicHoliday[] = [];
  importedHolidays: PublicHoliday[] = [];
  isLoadingOfficialHolidays = false;
  importForm = {
    zone: "metropole",
    year: new Date().getFullYear(),
  };
  manualForm = {
    zone: "metropole",
    date: "",
    label: "",
  };

  private readonly unsubscribe: Unsubscribe = onSnapshot(
    collection(db, "publicHolidays"),
    (snapshot) => {
      this.holidays = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as PublicHoliday)
        .sort((first, second) => first.date.localeCompare(second.date));
    },
    (error) => this.emitError(error),
  );

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  async loadOfficialHolidays(): Promise<void> {
    this.isLoadingOfficialHolidays = true;

    try {
      const response = await fetch(
        `https://calendrier.api.gouv.fr/jours-feries/${this.importForm.zone}/${this.importForm.year}.json`,
      );

      if (!response.ok) {
        throw new Error(`Réponse API invalide (${response.status})`);
      }

      const data = (await response.json()) as HolidaySourceResponse;
      this.importedHolidays = Object.entries(data)
        .map(([date, label]) => this.toHoliday(this.importForm.zone, date, label, "api.gouv.fr"))
        .sort((first, second) => first.date.localeCompare(second.date));

      this.success.emit(`${this.importedHolidays.length} jours fériés officiels chargés.`);
    } catch (error) {
      this.emitError(error);
    } finally {
      this.isLoadingOfficialHolidays = false;
    }
  }

  async saveImportedHolidays(): Promise<void> {
    if (!this.importedHolidays.length) {
      return;
    }

    try {
      await Promise.all(
        this.importedHolidays.map((holiday) =>
          setDoc(doc(db, "publicHolidays", holiday.id), {
            date: holiday.date,
            label: holiday.label,
            zone: holiday.zone,
            source: holiday.source,
          }),
        ),
      );

      this.success.emit("Jours fériés officiels enregistrés.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async saveManualHoliday(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    const holiday = this.toHoliday(this.manualForm.zone, this.manualForm.date, this.manualForm.label, "manual");

    try {
      await setDoc(doc(db, "publicHolidays", holiday.id), {
        date: holiday.date,
        label: holiday.label,
        zone: holiday.zone,
        source: holiday.source,
      });
      form.resetForm({
        zone: this.manualForm.zone,
        date: "",
        label: "",
      });
      this.success.emit("Jour férié enregistré.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteHoliday(holiday: PublicHoliday): Promise<void> {
    try {
      await deleteDoc(doc(db, "publicHolidays", holiday.id));
      this.success.emit("Jour férié supprimé.");
    } catch (error) {
      this.emitError(error);
    }
  }

  zoneLabel(zone: string): string {
    return this.zones.find((item) => item.id === zone)?.label || zone;
  }

  private toHoliday(zone: string, date: string, label: string, source: PublicHoliday["source"]): PublicHoliday {
    return {
      id: `${zone}_${date}`,
      date,
      label: label.trim(),
      zone,
      source,
    };
  }

  private emitError(error: unknown): void {
    this.error.emit(
      error instanceof FirebaseError
        ? `Erreur Firebase (${error.code}) : ${error.message}`
        : error instanceof Error
          ? error.message
          : "Erreur pendant la gestion des jours fériés.",
    );
  }
}
