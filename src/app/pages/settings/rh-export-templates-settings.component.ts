import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsRhTemplates } from "../../state/settings/settings.selectors";
import { RhExportTemplateSetting } from "./settings.models";

@Component({
  selector: "app-rh-export-templates-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-export-templates-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-export-templates-settings.component.scss"],
})
export class RhExportTemplatesSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  templates: RhExportTemplateSetting[] = [];

  private readonly store = inject(Store);
  private readonly savedTemplates = this.store.selectSignal(selectSettingsRhTemplates);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  constructor() {
    this.store.dispatch(SettingsActions.rhTemplatesWatchStarted());

    effect(() => {
      this.templates = this.savedTemplates().map((template) => ({ ...template }));
    });

    effect(() => {
      const message = this.settingsMessage();

      if (!message || message.source !== "rhTemplates" || message.completedAt === this.lastHandledMessage) {
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
    this.store.dispatch(SettingsActions.rhTemplatesWatchStopped());
  }

  setTemplateFile(template: RhExportTemplateSetting, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    template.fileName = file?.name || template.fileName;
  }

  saveTemplates(): void {
    this.store.dispatch(SettingsActions.rhTemplatesSaveRequested({ templates: this.templates }));
  }
}
