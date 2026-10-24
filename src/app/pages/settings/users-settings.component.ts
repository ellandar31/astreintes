import { TruncatedTextComponent } from "../../shared/truncated-text.component";
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
import { selectSettingsDirections, selectCanManageUsers, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser, UserRole } from "./settings.models";

@Component({
  selector: "app-users-settings",
  standalone: true,
  imports: [TruncatedTextComponent, ButtonModule, CommonModule, FormsModule, SelectModule, TableModule, TagModule],
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
    { value: 4, label: APP_LABELS.settings.users.roles.rh, description: APP_LABELS.settings.users.roles.rhDescription },
  ];

  private readonly store = inject(Store);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  readonly directions = this.store.selectSignal(selectSettingsDirections);
  // Drafts stay local until the administrator saves role and direction together.
  private drafts: Record<string, { role: UserRole; directionId: string | null }> = {};

  readonly users = this.store.selectSignal(selectSettingsUsers);
  readonly canManageUsers = this.store.selectSignal(selectCanManageUsers);

  constructor() {
    this.store.dispatch(SettingsActions.usersWatchStarted());
    effect(() => {
      if (!this.canManageUsers()) { this.drafts = {}; return; }
      for (const user of this.users()) {
        const draft = this.drafts[user.id];
        if (draft && draft.role === user.role && draft.directionId === (user.directionId || null)) delete this.drafts[user.id];
      }
    });

    effect(() => {
      const message = this.settingsMessage();

      if (message?.source !== "users" || message.completedAt === this.lastHandledMessage) {
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
    if (!this.canManageUsers()) return;
    this.drafts[user.id] = { role, directionId: this.directionFor(user) };
  }

  roleFor(user: ManagedUser): UserRole { return this.drafts[user.id]?.role ?? user.role; }

  directionFor(user: ManagedUser): string | null {
    return this.drafts[user.id] ? this.drafts[user.id].directionId : user.directionId || null;
  }

  requiresDirection(role: UserRole): boolean { return role === 2 || role === 3; }

  updateUserDirection(user: ManagedUser, directionId: string | null): void {
    if (!this.canManageUsers()) return;
    this.drafts[user.id] = { role: this.roleFor(user), directionId };
  }

  canSaveAssignment(user: ManagedUser): boolean {
    return this.canManageUsers()
      && (!this.directionFor(user) || this.directions().some(direction => direction.id === this.directionFor(user)))
      && (!this.requiresDirection(this.roleFor(user)) || Boolean(this.directionFor(user)))
      && (this.roleFor(user) !== user.role || this.directionFor(user) !== (user.directionId || null));
  }

  /** Save both fields atomically: a promoted initiator/director must never lack a direction. */
  saveUserAssignment(user: ManagedUser): void {
    if (!this.canManageUsers()) return;
    const role = this.roleFor(user);
    const directionId = this.directionFor(user);
    if (this.requiresDirection(role) && !directionId) {
      this.failure.emit(this.labels.directions.required);
      return;
    }
    if (!this.canSaveAssignment(user)) return;
    this.store.dispatch(SettingsActions.userRoleUpdateRequested({ role, userId: user.id, directionId }));
  }

  deleteUser(user: ManagedUser): void {
    if (!this.canManageUsers()) return;
    this.store.dispatch(SettingsActions.userDeleteRequested({ userId: user.id }));
  }

  roleLabel(role: UserRole): string {
    return this.roles.find((item) => item.value === Number(role))?.label ?? this.labels.settings.users.roles.user;
  }

  roleValue(value: string | number): UserRole {
    return Number(value) as UserRole;
  }
}
