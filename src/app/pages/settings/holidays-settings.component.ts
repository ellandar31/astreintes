import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { SettingsActions } from "../../state/settings/settings.actions";
import {
  selectSettingsHolidays,
  selectSettingsImportedHolidays,
  selectSettingsIsLoadingOfficialHolidays,
  selectSettingsMessage,
} from "../../state/settings/settings.selectors";
import { PublicHoliday } from "./settings.models";

@Component({
  selector: "app-holidays-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./holidays-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class HolidaysSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
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

  importForm = {
    zone: "metropole",
    year: new Date().getFullYear(),
  };
  manualForm = {
    zone: "metropole",
    date: "",
    label: "",
  };

  private readonly store = inject(Store);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  readonly holidays = this.store.selectSignal(selectSettingsHolidays);
  readonly importedHolidays = this.store.selectSignal(selectSettingsImportedHolidays);
  readonly isLoadingOfficialHolidays = this.store.selectSignal(selectSettingsIsLoadingOfficialHolidays);

  constructor() {
    this.store.dispatch(SettingsActions.holidaysWatchStarted());

    effect(() => {
      const message = this.settingsMessage();

      if (!message || message.source !== "holidays" || message.completedAt === this.lastHandledMessage) {
        return;
      }

      this.lastHandledMessage = message.completedAt;

      if (message.kind === "success") {
        this.success.emit(message.message);
        return;
      }

      this.failure.emit(message.message);
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(SettingsActions.holidaysWatchStopped());
  }

  loadOfficialHolidays(): void {
    this.store.dispatch(SettingsActions.officialHolidaysLoadRequested({ year: this.importForm.year, zone: this.importForm.zone }));
  }

  saveImportedHolidays(): void {
    const holidays = this.importedHolidays();

    if (!holidays.length) {
      return;
    }

    this.store.dispatch(SettingsActions.importedHolidaysSaveRequested({ holidays }));
  }

  saveManualHoliday(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    const holiday = this.toHoliday(this.manualForm.zone, this.manualForm.date, this.manualForm.label, "manual");
    this.store.dispatch(SettingsActions.manualHolidaySaveRequested({ holiday }));
    form.resetForm({
      zone: this.manualForm.zone,
      date: "",
      label: "",
    });
  }

  deleteHoliday(holiday: PublicHoliday): void {
    this.store.dispatch(SettingsActions.holidayDeleteRequested({ holidayId: holiday.id }));
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
}
