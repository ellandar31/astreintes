import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output, effect, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsTeams, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser, Team } from "./settings.models";

@Component({
  selector: "app-teams-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./teams-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class TeamsSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly labels = APP_LABELS;
  editingTeamId: string | null = null;
  teamForm = {
    name: "",
    selectedMemberId: "",
    members: [] as string[],
  };

  private readonly store = inject(Store);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private lastHandledMessage: number | null = null;

  readonly teams = this.store.selectSignal(selectSettingsTeams);
  readonly users = this.store.selectSignal(selectSettingsUsers);

  constructor() {
    this.store.dispatch(SettingsActions.teamsWatchStarted());
    this.store.dispatch(SettingsActions.usersWatchStarted());

    effect(() => {
      const message = this.settingsMessage();

      if (!message || message.source !== "teams" || message.completedAt === this.lastHandledMessage) {
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
    this.store.dispatch(SettingsActions.teamsWatchStopped());
    this.store.dispatch(SettingsActions.usersWatchStopped());
  }

  addTeamMember(): void {
    const selectedMemberId = this.teamForm.selectedMemberId;

    if (!selectedMemberId || this.teamForm.members.includes(selectedMemberId)) {
      return;
    }

    this.teamForm.members = [...this.teamForm.members, selectedMemberId];
    this.teamForm.selectedMemberId = "";
  }

  removeTeamMember(memberId: string): void {
    this.teamForm.members = this.teamForm.members.filter((currentMemberId) => currentMemberId !== memberId);
  }

  editTeam(team: Team): void {
    this.editingTeamId = team.id;
    this.teamForm = {
      name: team.name,
      selectedMemberId: "",
      members: [...team.members],
    };
  }

  saveTeam(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    this.store.dispatch(
      SettingsActions.teamSaveRequested({
        editingTeamId: this.editingTeamId,
        team: {
          name: this.teamForm.name.trim(),
          members: this.teamForm.members,
        },
      }),
    );
    this.resetTeamForm(form);
  }

  deleteTeam(team: Team): void {
    this.store.dispatch(SettingsActions.teamDeleteRequested({ teamId: team.id }));
  }

  resetTeamForm(form?: NgForm): void {
    this.editingTeamId = null;
    this.teamForm = {
      name: "",
      selectedMemberId: "",
      members: [],
    };
    form?.resetForm(this.teamForm);
  }

  availableUsers(): ManagedUser[] {
    return this.users().filter((user) => !this.teamForm.members.includes(user.id));
  }

  memberLabel(memberId: string): string {
    const user = this.users().find((item) => item.id === memberId || item.email === memberId);

    if (!user) {
      return memberId;
    }

    return this.userLabel(user);
  }

  userLabel(user: ManagedUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }
}
