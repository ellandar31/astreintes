import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { MessageModule } from "primeng/message";
import { APP_LABELS } from "../../i18n/labels";
import { HolidaysSettingsComponent } from "./holidays-settings.component";
import { RhCompensationSettingsComponent } from "./rh-compensation-settings.component";
import { RhExportTemplatesSettingsComponent } from "./rh-export-templates-settings.component";
import { SettingsSection } from "./settings.models";
import { TeamsSettingsComponent } from "./teams-settings.component";
import { UsersSettingsComponent } from "./users-settings.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CommonModule,
    HolidaysSettingsComponent,
    MessageModule,
    RhCompensationSettingsComponent,
    RhExportTemplatesSettingsComponent,
    TeamsSettingsComponent,
    UsersSettingsComponent,
  ],
  templateUrl: "./settings-page.component.html",
  styleUrl: "./settings-page.component.css",
})
export class SettingsPageComponent {
  readonly labels = APP_LABELS;
  readonly sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "users", label: APP_LABELS.settings.menu.users },
    { id: "teams", label: APP_LABELS.settings.menu.teams },
    { id: "holidays", label: APP_LABELS.settings.menu.holidays },
    { id: "rhCompensation", label: APP_LABELS.settings.menu.rhCompensation },
    { id: "rhExports", label: APP_LABELS.settings.menu.rhExports },
  ];

  activeSection: SettingsSection = "users";
  settingsError = "";
  settingsSuccess = "";

  setSection(section: SettingsSection): void {
    this.activeSection = section;
    this.clearMessages();
  }

  showSuccess(message: string): void {
    this.settingsError = "";
    this.settingsSuccess = message;
  }

  showError(message: string): void {
    this.settingsSuccess = "";
    this.settingsError = message;
  }

  private clearMessages(): void {
    this.settingsError = "";
    this.settingsSuccess = "";
  }
}
