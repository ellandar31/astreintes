import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { HolidaysSettingsComponent } from "./holidays-settings.component";
import { RhCompensationSettingsComponent } from "./rh-compensation-settings.component";
import { RhControlsSettingsComponent } from "./rh-controls-settings.component";
import { RhExportTemplatesSettingsComponent } from "./rh-export-templates-settings.component";
import { SchedulesSettingsComponent } from "./schedules-settings.component";
import { SettingsSection } from "./settings.models";
import { TeamsSettingsComponent } from "./teams-settings.component";
import { UsersSettingsComponent } from "./users-settings.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [
    CommonModule,
    HolidaysSettingsComponent,
    RhCompensationSettingsComponent,
    RhControlsSettingsComponent,
    RhExportTemplatesSettingsComponent,
    SchedulesSettingsComponent,
    TeamsSettingsComponent,
    UsersSettingsComponent,
  ],
  templateUrl: "./settings-page.component.html",
  styleUrl: "./settings-page.component.css",
})
export class SettingsPageComponent {
  readonly sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "users", label: "Gestion des utilisateurs" },
    { id: "teams", label: "Gestion des équipes" },
    { id: "schedules", label: "Gestion des horaires HO" },
    { id: "holidays", label: "Gestion des jours fériés" },
    { id: "rhControls", label: "Contrôles RH" },
    { id: "rhCompensation", label: "Indemnités RH" },
    { id: "rhExports", label: "Modèles Word RH" },
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
