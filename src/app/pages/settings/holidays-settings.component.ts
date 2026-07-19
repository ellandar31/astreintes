import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputNumberModule } from "primeng/inputnumber";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
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
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule],
  templateUrl: "./holidays-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class HolidaysSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  readonly zones = [
    { id: "metropole", label: APP_LABELS.settings.zones.metropole },
    { id: "alsace-moselle", label: APP_LABELS.settings.zones.alsaceMoselle },
    { id: "guadeloupe", label: APP_LABELS.settings.zones.guadeloupe },
    { id: "guyane", label: APP_LABELS.settings.zones.guyane },
    { id: "la-reunion", label: APP_LABELS.settings.zones.laReunion },
    { id: "martinique", label: APP_LABELS.settings.zones.martinique },
    { id: "mayotte", label: APP_LABELS.settings.zones.mayotte },
    { id: "nouvelle-caledonie", label: APP_LABELS.settings.zones.nouvelleCaledonie },
    { id: "polynesie-francaise", label: APP_LABELS.settings.zones.polynesieFrancaise },
    { id: "saint-barthelemy", label: APP_LABELS.settings.zones.saintBarthelemy },
    { id: "saint-martin", label: APP_LABELS.settings.zones.saintMartin },
    { id: "saint-pierre-et-miquelon", label: APP_LABELS.settings.zones.saintPierreEtMiquelon },
    { id: "wallis-et-futuna", label: APP_LABELS.settings.zones.wallisEtFutuna },
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
