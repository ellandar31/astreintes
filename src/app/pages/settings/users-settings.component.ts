import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FirebaseStore, StoreUnsubscribe } from "../../store/firebase.store";
import { ManagedUser, UserRole } from "./settings.models";

@Component({
  selector: "app-users-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./users-settings.component.html",
  styleUrls: ["./settings-common.scss"],
})
export class UsersSettingsComponent implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  readonly roles: Array<{ value: UserRole; label: string; description: string }> = [
    { value: 0, label: "Administrateur", description: "Accès complet, incluant les droits utilisateur." },
    { value: 1, label: "Utilisateur", description: "Accès standard par défaut." },
    { value: 2, label: "Initiateur", description: "Droits utilisateur inclus, avec capacité d'initier." },
  ];

  users: ManagedUser[] = [];

  private readonly unsubscribe: StoreUnsubscribe;

  constructor(private readonly firebaseStore: FirebaseStore) {
    this.unsubscribe = this.firebaseStore.watchCollection<ManagedUser>(
      "users",
      (users) => {
        this.users = users
        .sort((first, second) => first.email.localeCompare(second.email));
      },
      (error) => this.emitError(error),
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  async updateUserRole(user: ManagedUser, role: UserRole): Promise<void> {
    try {
      await this.firebaseStore.updateDocument("users", user.id, {
        role: Number(role) as UserRole,
      });
      this.success.emit("Rôle utilisateur mis à jour.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteUser(user: ManagedUser): Promise<void> {
    try {
      await this.firebaseStore.deleteDocument("users", user.id);
      this.success.emit("Utilisateur retiré de la liste applicative.");
    } catch (error) {
      this.emitError(error);
    }
  }

  roleLabel(role: UserRole): string {
    return this.roles.find((item) => item.value === Number(role))?.label || "Utilisateur";
  }

  roleValue(value: string | number): UserRole {
    return Number(value) as UserRole;
  }

  private emitError(error: unknown): void {
    this.error.emit(this.firebaseStore.firebaseErrorMessage(error, "Erreur pendant la gestion des utilisateurs."));
  }
}
