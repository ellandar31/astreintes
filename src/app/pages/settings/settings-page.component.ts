import { CommonModule } from "@angular/common";
import { Component, computed, effect, inject } from "@angular/core";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { MessageModule } from "primeng/message";
import { APP_LABELS } from "../../i18n/labels";
import { selectCanManageUsers } from "../../state/settings/settings.selectors";
import { HolidaysSettingsComponent } from "./holidays-settings.component";
import { RhCompensationSettingsComponent } from "./rh-compensation-settings.component";
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
    TeamsSettingsComponent,
    UsersSettingsComponent,
  ],
  templateUrl: "./settings-page.component.html",
  styleUrl: "./settings-page.component.css",
})
export class SettingsPageComponent {
  readonly labels = APP_LABELS;
  private readonly store = inject(Store);
  private readonly isAdmin = this.store.selectSignal(selectCanManageUsers);
  private readonly allSections: Array<{ id: SettingsSection; label: string }> = [
    { id: "users", label: APP_LABELS.settings.menu.users },
    { id: "teams", label: APP_LABELS.settings.menu.teams },
    { id: "holidays", label: APP_LABELS.settings.menu.holidays },
    { id: "rhCompensation", label: APP_LABELS.settings.menu.rhCompensation },
  ];

  readonly sections = computed(() => this.allSections.filter(section => this.isAdmin() || section.id === "teams"));
  private requestedSection: SettingsSection = "users";
  settingsError = "";
  settingsSuccess = "";

  constructor() {
    effect(() => {
      if (!this.isAdmin()) {
        this.requestedSection = "teams";
        this.clearMessages();
      }
    });
  }

  /** Check permissions at render time too: revocation must unmount a privileged page before any subsequent click. */
  get activeSection(): SettingsSection {
    return this.isAdmin() ? this.requestedSection : "teams";
  }

  setSection(section: SettingsSection): void {
    if (!this.sections().some(item => item.id === section)) {
      return;
    }
    this.requestedSection = section;
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
