import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { StoreUnsubscribe, appStore } from "../../store/app-store";
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

  users: ManagedUser[] = [];

  private readonly unsubscribe: StoreUnsubscribe = appStore.data.observeCollection<ManagedUser>(
    appStore.paths.users(),
    (documents) => {
      this.users = documents
        .map((document) => ({ ...document.data, id: document.id }) as ManagedUser)
        .sort((first, second) => first.email.localeCompare(second.email));
    },
    (error) => this.emitError(error),
  );

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  async updateUserRole(user: ManagedUser, role: UserRole): Promise<void> {
    try {
      await appStore.data.updateDocument(appStore.paths.user(user.id), {
        role: Number(role) as UserRole,
      });
      this.success.emit("Rôle utilisateur mis à jour.");
    } catch (error) {
      this.emitError(error);
    }
  }

  async deleteUser(user: ManagedUser): Promise<void> {
    try {
      await appStore.data.deleteDocument(appStore.paths.user(user.id));
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
    this.failure.emit(
      appStore.errors.isError(error)
        ? `Erreur Base de données (${error.code}) : ${error.message}`
        : "Erreur pendant la gestion des utilisateurs.",
    );
  }
}
