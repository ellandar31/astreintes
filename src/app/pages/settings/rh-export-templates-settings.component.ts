import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsRhGenerationApiUrl, selectSettingsRhTemplates } from "../../state/settings/settings.selectors";
import { RhExportTemplateSetting } from "./settings.models";

@Component({
  selector: "app-rh-export-templates-settings",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputTextModule],
  templateUrl: "./rh-export-templates-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-export-templates-settings.component.scss"],
})
export class RhExportTemplatesSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  generationApiUrl = "";
  templates: RhExportTemplateSetting[] = [];

  private readonly store = inject(Store);
  private readonly savedGenerationApiUrl = this.store.selectSignal(selectSettingsRhGenerationApiUrl);
  private readonly savedTemplates = this.store.selectSignal(selectSettingsRhTemplates);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  constructor() {
    this.store.dispatch(SettingsActions.rhTemplatesWatchStarted());

    effect(() => {
      this.generationApiUrl = this.savedGenerationApiUrl();
      this.templates = this.savedTemplates().map((template) => ({ ...template }));
    });

    effect(() => {
      const message = this.settingsMessage();

      if (message?.source !== "rhTemplates" || message.completedAt === this.lastHandledMessage) {
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

  async setTemplateFile(template: RhExportTemplateSetting, event: Event): Promise<void> {
    await this.setJsonFile(template, event, "generationTemplate", "templateFileName");
    template.fileName = template.templateFileName || template.fileName;
  }

  async setDataModelFile(template: RhExportTemplateSetting, event: Event): Promise<void> {
    await this.setJsonFile(template, event, "dataModel", "dataModelFileName");
  }

  private async setJsonFile(
    template: RhExportTemplateSetting,
    event: Event,
    contentProperty: "generationTemplate" | "dataModel",
    fileNameProperty: "templateFileName" | "dataModelFileName",
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      template[contentProperty] = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      template[fileNameProperty] = file.name;
    } catch {
      this.failure.emit(this.labels.settings.rhTemplates.invalidJson);
      input.value = "";
    }
  }

  saveTemplates(): void {
    this.store.dispatch(SettingsActions.rhTemplatesSaveRequested({ generationApiUrl: this.generationApiUrl, templates: this.templates }));
  }
}
