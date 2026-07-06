import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { doc, onSnapshot, setDoc, Unsubscribe } from "firebase/firestore";
import { db } from "../../firebase";

interface OnCallCompensationRule {
  id: string;
  label: string;
  coefficient: number;
}

interface PeriodCompensationRule {
  id: string;
  label: string;
  interventionCoefficient: number;
  workCoefficient: number;
  restCoefficient: number;
}

@Component({
  selector: "app-rh-compensation-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-compensation-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-compensation-settings.component.scss"],
})
export class RhCompensationSettingsComponent implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  onCallRows: OnCallCompensationRule[] = [
    { id: "week", label: "Semaine", coefficient: 0 },
    { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 0 },
  ];

  periodRows: PeriodCompensationRule[] = [
    { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "night_21_7", label: "Nuit (21h-7h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "saturday_7_21", label: "Samedi (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "sunday_holiday_7_21", label: "Dimanche/Jours fériés (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  ];

  private readonly settingsRef = doc(db, "rhSettings", "compensationRules");

  private readonly unsubscribe: Unsubscribe = onSnapshot(this.settingsRef, (snapshot) => {
    const data = snapshot.data();

    if (!data) {
      return;
    }

    this.onCallRows = this.mergeRows(this.onCallRows, data["onCall"] || []);
    this.periodRows = this.mergeRows(this.periodRows, data["periods"] || []);
  });

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  async saveCompensationRules(): Promise<void> {
    await setDoc(this.settingsRef, {
      onCall: this.onCallRows,
      periods: this.periodRows,
      updatedAt: new Date().toISOString(),
    });

    this.success.emit("Règles d’indemnisation enregistrées.");
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => ({
      ...defaultRow,
      ...(savedRows.find((row) => row.id === defaultRow.id) || {}),
    }));
  }
}