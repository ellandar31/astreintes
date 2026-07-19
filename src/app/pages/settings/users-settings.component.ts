import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser, UserRole } from "./settings.models";

@Component({
  selector: "app-users-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./users-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class UsersSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly roles: Array<{ value: UserRole; label: string; description: string }> = [
    { value: 0, label: "Administrateur", description: "Accès complet, incluant les droits utilisateur." },
    { value: 1, label: "Utilisateur", description: "Accès standard par défaut." },
    { value: 2, label: "Initiateur", description: "Droits utilisateur inclus, avec capacité d'initier." },
    { value: 3, label: "Directeur", description: "Droits utilisateur inclus, avec capacité de viser les validations directeur." },
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
    return this.roles.find((item) => item.value === Number(role))?.label || "Utilisateur";
  }

  roleValue(value: string | number): UserRole {
    return Number(value) as UserRole;
  }
}
