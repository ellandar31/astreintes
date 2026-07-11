import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseError } from "firebase/app";
import { Unsubscribe, addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
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

  editingTeamId: string | null = null;
  teams: Team[] = [];
  users: ManagedUser[] = [];
  teamForm = {
    name: "",
    selectedMemberId: "",
    members: [] as string[],
  };

  private readonly unsubscribes: Unsubscribe[] = [
    onSnapshot(
      collection(db, "teams"),
      (snapshot) => {
        this.teams = snapshot.docs
          .map((document) => {
            const data = document.data();
            return {
              id: document.id,
              name: String(data["name"] || ""),
              members: this.normalizeMembers(data["members"]),
            };
          })
          .sort((first, second) => first.name.localeCompare(second.name));
      },
      (error) => this.emitError(error),
    ),
    onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        this.users = snapshot.docs
          .map((document) => ({ id: document.id, ...document.data() }) as ManagedUser)
          .filter((user) => Boolean(user.email))
          .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
      },
      (error) => this.emitError(error),
    ),
  ];

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
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

  async saveTeam(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    const payload = {
      name: this.teamForm.name.trim(),
      members: this.teamForm.members,
    };

    try {
      if (this.editingTeamId) {
        await setDoc(doc(db, "teams", this.editingTeamId), payload);
      } else {
        await addDoc(collection(db, "teams"), payload);
      }

      this.resetTeamForm(form);
      this.success.emit("Équipe enregistrée.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteTeam(team: Team): Promise<void> {
    try {
      await deleteDoc(doc(db, "teams", team.id));
      this.success.emit("Équipe supprimée.");
    } catch (error) {
      this.emitError(error);
    }
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
    return this.users.filter((user) => !this.teamForm.members.includes(user.id));
  }

  memberLabel(memberId: string): string {
    const user = this.users.find((item) => item.id === memberId || item.email === memberId);

    if (!user) {
      return memberId;
    }

    return this.userLabel(user);
  }

  userLabel(user: ManagedUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private normalizeMembers(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((member) => {
        if (typeof member === "string") {
          return member;
        }

        if (member && typeof member === "object") {
          if ("id" in member) {
            return String(member.id);
          }

          if ("uid" in member) {
            return String(member.uid);
          }

          if ("email" in member) {
            return String(member.email);
          }
        }

        return "";
      })
      .filter(Boolean);
  }

  private emitError(error: unknown): void {
    this.failure.emit(
      error instanceof FirebaseError
        ? `Erreur Firebase (${error.code}) : ${error.message}`
        : "Erreur pendant l'enregistrement de l'équipe.",
    );
  }
}
