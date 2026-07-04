import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseError } from "firebase/app";
import { Unsubscribe, addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Team } from "./settings.models";

@Component({
  selector: "app-teams-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./teams-settings.component.html",
})
export class TeamsSettingsComponent implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  editingTeamId: string | null = null;
  teams: Team[] = [];
  teamForm = {
    name: "",
    memberEmail: "",
    members: [] as string[],
  };

  private readonly unsubscribe: Unsubscribe = onSnapshot(
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
  );

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  addTeamMember(): void {
    const email = this.teamForm.memberEmail.trim().toLowerCase();

    if (!email || this.teamForm.members.includes(email)) {
      return;
    }

    this.teamForm.members = [...this.teamForm.members, email];
    this.teamForm.memberEmail = "";
  }

  removeTeamMember(email: string): void {
    this.teamForm.members = this.teamForm.members.filter((memberEmail) => memberEmail !== email);
  }

  editTeam(team: Team): void {
    this.editingTeamId = team.id;
    this.teamForm = {
      name: team.name,
      memberEmail: "",
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
      memberEmail: "",
      members: [],
    };
    form?.resetForm(this.teamForm);
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

        if (member && typeof member === "object" && "email" in member) {
          return String(member.email);
        }

        return "";
      })
      .filter(Boolean);
  }

  private emitError(error: unknown): void {
    this.error.emit(
      error instanceof FirebaseError
        ? `Erreur Firebase (${error.code}) : ${error.message}`
        : "Erreur pendant l'enregistrement de l'équipe.",
    );
  }
}
