import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { CheckboxModule } from "primeng/checkbox";
import { TruncatedTextComponent } from "../../shared/truncated-text.component";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { SharedTableModule } from "../../shared/shared-table.module";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsDirections, selectCanManageUsers, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser, UserRole } from "./settings.models";

@Component({
  selector: "app-users-settings",
  standalone: true,
  imports: [TableColumnHeaderComponent, TableRowsPipe, CheckboxModule, TruncatedTextComponent, ButtonModule, CommonModule, FormsModule, SelectModule, SharedTableModule, TagModule],
  templateUrl: "./users-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class UsersSettingsComponent implements OnDestroy {
  readonly userTableFields = {
    tableName: (row: ManagedUser) => row.displayName || row.email,
    tableRole: (row: ManagedUser) => this.roleLabel(row.role),
    tableDirection: (row: ManagedUser) => this.directions().find(direction => direction.id === row.directionId)?.name || "",
  };
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

  readonly directions = this.store.selectSignal(selectSettingsDirections);
  // Save role, mandatory direction and independent export permission in one profile update.
  private drafts: Record<string, { role: UserRole; directionId: string | null; isRh: boolean }> = {};

  readonly users = this.store.selectSignal(selectSettingsUsers);
  readonly canManageUsers = this.store.selectSignal(selectCanManageUsers);

  constructor() {
    this.store.dispatch(SettingsActions.usersWatchStarted());
    effect(() => {
      if (!this.canManageUsers()) { this.drafts = {}; return; }
      for (const user of this.users()) {
        const draft = this.drafts[user.id];
        if (draft && draft.role === user.role && draft.directionId === (user.directionId || null) && draft.isRh === Boolean(user.isRh)) delete this.drafts[user.id];
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
    this.drafts[user.id] = { role, directionId: this.directionFor(user), isRh: this.rhFor(user) };
  }

  roleFor(user: ManagedUser): UserRole { return this.drafts[user.id]?.role ?? user.role; }

  directionFor(user: ManagedUser): string | null {
    return this.drafts[user.id] ? this.drafts[user.id].directionId : user.directionId || null;
  }

  rhFor(user: ManagedUser): boolean { return this.drafts[user.id]?.isRh ?? Boolean(user.isRh); }

  updateUserRh(user: ManagedUser, isRh: boolean): void {
    if (!this.canManageUsers()) return;
    this.drafts[user.id] = { role: this.roleFor(user), directionId: this.directionFor(user), isRh };
  }

  requiresDirection(role: UserRole): boolean { return role === 2 || role === 3; }

  updateUserDirection(user: ManagedUser, directionId: string | null): void {
    if (!this.canManageUsers()) return;
    this.drafts[user.id] = { role: this.roleFor(user), directionId, isRh: this.rhFor(user) };
  }

  canSaveAssignment(user: ManagedUser): boolean {
    return this.canManageUsers()
      && (!this.directionFor(user) || this.directions().some(direction => direction.id === this.directionFor(user)))
      && (!this.requiresDirection(this.roleFor(user)) || Boolean(this.directionFor(user)))
      && (this.roleFor(user) !== user.role || this.directionFor(user) !== (user.directionId || null) || this.rhFor(user) !== Boolean(user.isRh));
  }

  /** A role promotion and its required direction must be saved with the export permission atomically. */
  saveUserAssignment(user: ManagedUser): void {
    if (!this.canManageUsers()) return;
    const role = this.roleFor(user);
    const directionId = this.directionFor(user);
    if (this.requiresDirection(role) && !directionId) {
      this.failure.emit(this.labels.directions.required);
      return;
    }
    if (!this.canSaveAssignment(user)) return;
    this.store.dispatch(SettingsActions.userRoleUpdateRequested({ role, userId: user.id, directionId, isRh: this.rhFor(user) }));
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
