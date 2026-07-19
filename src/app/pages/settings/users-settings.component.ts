import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser, UserRole } from "./settings.models";

@Component({
  selector: "app-users-settings",
  standalone: true,
  imports: [ButtonModule, CommonModule, FormsModule, SelectModule, TableModule, TagModule],
  templateUrl: "./users-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class UsersSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  readonly roles: Array<{ value: UserRole; label: string; description: string }> = [
    { value: 0, label: APP_LABELS.settings.users.roles.admin, description: APP_LABELS.settings.users.roles.adminDescription },
    { value: 1, label: APP_LABELS.settings.users.roles.user, description: APP_LABELS.settings.users.roles.userDescription },
    { value: 2, label: APP_LABELS.settings.users.roles.initiator, description: APP_LABELS.settings.users.roles.initiatorDescription },
    { value: 3, label: APP_LABELS.settings.users.roles.director, description: APP_LABELS.settings.users.roles.directorDescription },
  ];

  private readonly store = inject(Store);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  readonly users = this.store.selectSignal(selectSettingsUsers);

  constructor() {
    this.store.dispatch(SettingsActions.usersWatchStarted());

    effect(() => {
      const message = this.settingsMessage();

      if (!message || message.source !== "users" || message.completedAt === this.lastHandledMessage) {
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
    this.store.dispatch(SettingsActions.usersWatchStopped());
  }

  updateUserRole(user: ManagedUser, role: UserRole): void {
    this.store.dispatch(SettingsActions.userRoleUpdateRequested({ role, userId: user.id }));
  }

  deleteUser(user: ManagedUser): void {
    this.store.dispatch(SettingsActions.userDeleteRequested({ userId: user.id }));
  }

  roleLabel(role: UserRole): string {
    return this.roles.find((item) => item.value === Number(role))?.label || this.labels.settings.users.roles.user;
  }

  roleValue(value: string | number): UserRole {
    return Number(value) as UserRole;
  }
}
