import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputNumberModule } from "primeng/inputnumber";
import { TableModule } from "primeng/table";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsRhCompensation } from "../../state/settings/settings.selectors";
import { OnCallCompensationRule, PeriodCompensationRule } from "./settings.models";

@Component({
  selector: "app-rh-compensation-settings",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputNumberModule, TableModule],
  templateUrl: "./rh-compensation-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-compensation-settings.component.scss"],
})
export class RhCompensationSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  onCallRows: OnCallCompensationRule[] = [];
  periodRows: PeriodCompensationRule[] = [];

  private readonly store = inject(Store);
  private readonly settings = this.store.selectSignal(selectSettingsRhCompensation);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  constructor() {
    this.store.dispatch(SettingsActions.rhCompensationWatchStarted());

    effect(() => {
      const settings = this.settings();

      if (settings) {
        this.onCallRows = settings.onCall.map((row) => ({ ...row }));
        this.periodRows = settings.periods.map((row) => ({ ...row }));
      }
    });

    effect(() => {
      const message = this.settingsMessage();

      if (!message || message.source !== "rhCompensation" || message.completedAt === this.lastHandledMessage) {
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
    this.store.dispatch(SettingsActions.rhCompensationWatchStopped());
  }

  saveCompensationRules(): void {
    this.store.dispatch(
      SettingsActions.rhCompensationSaveRequested({
        settings: {
          onCall: this.onCallRows,
          periods: this.periodRows,
        },
      }),
    );
  }
}
