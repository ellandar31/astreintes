import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { HolidaysSettingsComponent } from "./holidays-settings.component";
import { SchedulesSettingsComponent } from "./schedules-settings.component";
import { SettingsSection } from "./settings.models";
import { TeamsSettingsComponent } from "./teams-settings.component";
import { UsersSettingsComponent } from "./users-settings.component";
import { RhControlsSettingsComponent } from "./rh-controls-settings.component";
import { RhCompensationSettingsComponent } from "./rh-compensation-settings.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [
    CommonModule,
    HolidaysSettingsComponent,
    SchedulesSettingsComponent,
    TeamsSettingsComponent,
    UsersSettingsComponent,
    RhControlsSettingsComponent,
    RhCompensationSettingsComponent,
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
    { id: "rhControls", label: "Gestion des Contrôles RH" },
    { id: "rhCompensation", label: "Gestion des indemnités RH" },
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
