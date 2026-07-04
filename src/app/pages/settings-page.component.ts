import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { HolidaysSettingsComponent } from "./settings/holidays-settings.component";
import { SchedulesSettingsComponent } from "./settings/schedules-settings.component";
import { SettingsSection } from "./settings/settings.models";
import { TeamsSettingsComponent } from "./settings/teams-settings.component";
import { UsersSettingsComponent } from "./settings/users-settings.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [
    CommonModule,
    HolidaysSettingsComponent,
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
    { id: "schedules", label: "Gestion des horaires" },
    { id: "holidays", label: "Gestion des jours fériés" },
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
